// One sync round: drain the outbox, then pull past the cursor. Scheduling and
// retry timing belong to the caller (retryDelay).
import type { LocalStore, Op, RemoteRow } from "./localStore";

export type { RemoteRow };

/** Bump with every local schema change; sync_push rejects versions below app_config.min_schema_version. */
export const SCHEMA_VERSION = 1;
export const PUSH_BATCH = 500;
// Must not exceed PostgREST api.max_rows, or a truncated page ends the pull early.
export const PULL_PAGE = 1_000;

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 5 * 60_000;

export interface RemoteApi {
  /** Applies all ops in one transaction or none. */
  push(ops: Op[], schemaVersion: number): Promise<void>;
  pull(since: number, page: number): Promise<RemoteRow[]>;
}

/** Server refused the client schema; keep data local until the app updates. */
export class UpgradeRequired extends Error {
  constructor() {
    super("app update required");
    this.name = "UpgradeRequired";
  }
}

export async function sync(store: LocalStore, remote: RemoteApi): Promise<void> {
  await push(store, remote);
  await pull(store, remote);
}

export const retryDelay = (attempt: number) => Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);

async function push(store: LocalStore, remote: RemoteApi): Promise<void> {
  for (;;) {
    const batch = await store.pending(PUSH_BATCH);
    const last = batch.at(-1);
    if (last === undefined) {
      return;
    }

    await pushSplit(remote, batch.map((p) => p.op));
    await store.ack(last.seq);
  }
}

/** Halves a failing batch so one oversized payload does not block the rest. */
async function pushSplit(remote: RemoteApi, ops: Op[]): Promise<void> {
  try {
    await remote.push(ops, SCHEMA_VERSION);
  } catch (e) {
    if (e instanceof UpgradeRequired || ops.length === 1) {
      throw e;
    }
    const mid = Math.ceil(ops.length / 2);
    await pushSplit(remote, ops.slice(0, mid));
    await pushSplit(remote, ops.slice(mid));
  }
}

async function pull(store: LocalStore, remote: RemoteApi): Promise<void> {
  for (;;) {
    const rows = await remote.pull(await store.cursor(), PULL_PAGE);
    await store.applyRemote(rows);
    if (rows.length < PULL_PAGE) {
      return;
    }
  }
}
