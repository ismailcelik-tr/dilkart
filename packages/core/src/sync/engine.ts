// One sync round: drain the outbox, then pull past the cursor. Scheduling and
// retry timing belong to the caller (retryDelay).
import type { LocalStore, Op, Pending, RemoteRow } from "./localStore";

export type { RemoteRow };

/** Bump with every local schema change; sync_push rejects versions below app_config.min_schema_version. */
export const SCHEMA_VERSION = 1;
export const PUSH_BATCH = 500;
// Must not exceed PostgREST api.max_rows, or a truncated page ends the pull early.
export const PULL_PAGE = 1_000;

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 5 * 60_000;
// A clock this far ahead would stamp edits that win every later conflict (plan, gate risk R2).
const MAX_CLOCK_AHEAD_MS = 24 * 60 * 60_000;

export interface RemoteApi {
  /** Applies all ops in one transaction or none. */
  push(ops: Op[], schemaVersion: number): Promise<void>;
  pull(since: number, page: number): Promise<RemoteRow[]>;
  /** Server wall clock in ms. */
  serverTime(): Promise<number>;
}

/** The server rejects this payload for good; retrying the same ops cannot succeed. */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

/** Device clock is too far ahead of the server; sync waits until it is corrected. */
export class ClockAhead extends Error {
  constructor(readonly aheadMs: number) {
    super("device clock ahead of server");
    this.name = "ClockAhead";
  }
}

/** Server refused the client schema; keep data local until the app updates. */
export class UpgradeRequired extends Error {
  constructor() {
    super("app update required");
    this.name = "UpgradeRequired";
  }
}

/** Returns cards whose review logs were pulled; their derived FSRS state is stale. */
export async function sync(store: LocalStore, remote: RemoteApi, now: () => number = Date.now): Promise<string[]> {
  const ahead = now() - (await remote.serverTime());
  if (ahead > MAX_CLOCK_AHEAD_MS) {
    throw new ClockAhead(ahead);
  }

  await push(store, remote);
  return pull(store, remote);
}

export const retryDelay = (attempt: number) => Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);

async function push(store: LocalStore, remote: RemoteApi): Promise<void> {
  for (;;) {
    const batch = await store.pending(PUSH_BATCH);
    const last = batch.at(-1);
    if (last === undefined) {
      return;
    }

    await pushSplit(store, remote, batch);
    await store.ack(last.seq);
  }
}

/**
 * Halves a rejected batch until the bad op is alone, then parks it in the failed
 * queue so it cannot block the outbox (gate risk R1). Outages are retried whole.
 */
async function pushSplit(store: LocalStore, remote: RemoteApi, batch: Pending[]): Promise<void> {
  try {
    await remote.push(
      batch.map((p) => p.op),
      SCHEMA_VERSION,
    );
  } catch (e) {
    if (!(e instanceof PermanentError)) {
      throw e;
    }
    const [only] = batch;
    if (batch.length === 1 && only !== undefined) {
      await store.fail(only.seq, e.message);
      return;
    }
    const mid = Math.ceil(batch.length / 2);
    await pushSplit(store, remote, batch.slice(0, mid));
    await pushSplit(store, remote, batch.slice(mid));
  }
}

async function pull(store: LocalStore, remote: RemoteApi): Promise<string[]> {
  const touched = new Set<string>();
  for (;;) {
    const rows = await remote.pull(await store.cursor(), PULL_PAGE);
    for (const id of await store.applyRemote(rows)) {
      touched.add(id);
    }
    if (rows.length < PULL_PAGE) {
      return [...touched];
    }
  }
}
