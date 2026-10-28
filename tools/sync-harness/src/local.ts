// Test fixtures against the local Supabase from `supabase start`.
import { execFileSync } from "node:child_process";

import { LocalStore, rpcRemote, sync, Table, uuidv7, type Review } from "@dilkart/core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { nodeDriver } from "./driver";

const REPO_ROOT = new URL("../../..", import.meta.url);
const PASSWORD = "harness-password-1";

let env: Record<string, string> | undefined;

function status(): Record<string, string> {
  if (env === undefined) {
    const out = execFileSync("supabase", ["status", "-o", "env"], { cwd: REPO_ROOT, encoding: "utf8" });
    env = Object.fromEntries(
      out.split("\n").flatMap((line) => {
        const m = /^(\w+)="?(.*?)"?$/.exec(line);
        return m?.[1] && m[2] !== undefined ? [[m[1], m[2]]] : [];
      }),
    );
  }
  return env;
}

export function anonClient(): SupabaseClient {
  const { API_URL, PUBLISHABLE_KEY } = status();
  if (!API_URL || !PUBLISHABLE_KEY) {
    throw new Error("local Supabase is not running: supabase start");
  }
  return createClient(API_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
}

/** A fresh, already verified account with a signed-in client; skips the e-mail round trip. */
export async function signUp(): Promise<SupabaseClient> {
  const { API_URL, SERVICE_ROLE_KEY } = status();
  const admin = createClient(API_URL ?? "", SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
  const email = `${uuidv7()}@harness.local`;
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.error) {
    throw created.error;
  }

  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) {
    throw error;
  }
  return client;
}

const MAILPIT = "http://127.0.0.1:54324";
const CODE = /\b\d{6}\b/;
const POLL_MS = 200;
const MAIL_WAIT_MS = 10_000;

/** The code in the newest of at least `count` mails Mailpit holds for `email`. */
export async function latestCode(email: string, count = 1): Promise<string> {
  const deadline = Date.now() + MAIL_WAIT_MS;
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    const [newest] = messages;
    if (newest !== undefined && messages.length >= count) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`)).json()) as { Text: string };
      const code = CODE.exec(message.Text)?.[0];
      if (code !== undefined) {
        return code;
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`no code mailed to ${email}`);
}

export interface DeviceOptions {
  path?: string;
  now?: () => number;
}

/** One app install. Without a client it is a guest device until `login`. */
export async function device(name: string, client?: SupabaseClient, opts: DeviceOptions = {}) {
  const db = nodeDriver(opts.path);
  const store = new LocalStore(db, name, opts.now);
  await store.open();

  let remote = client && rpcRemote(client);
  return {
    store,
    login: (c: SupabaseClient) => {
      remote = rpcRemote(c);
    },
    sync: async () => {
      if (remote === undefined) {
        throw new Error("guest device has no remote");
      }
      await sync(store, remote);
    },
    count: async (table: Table) => (await db.all<{ n: number }>(`SELECT count(*) AS n FROM ${table}`, []))[0]?.n ?? 0,
    /** Review logs as the scheduler reads them. */
    reviews: async (cardId: string): Promise<Review[]> =>
      (
        await db.all<{ id: string; reviewed_at: string; rating: number; scheduled: number | null }>(
          `SELECT id, reviewed_at, rating, scheduled FROM ${Table.ReviewLogs} WHERE card_id = ?`,
          [cardId],
        )
      ).map((r) => ({ id: r.id, reviewedAt: r.reviewed_at, rating: r.rating, scheduled: r.scheduled !== 0 })),
    close: () => db.close(),
  };
}
