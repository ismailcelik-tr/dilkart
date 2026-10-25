// Test fixtures against the local Supabase from `supabase start`.
import { execFileSync } from "node:child_process";

import { LocalStore, sync, uuidv7, type Table } from "@dilkart/core";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { nodeDriver } from "./driver";
import { supabaseRemote } from "./remote";

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

/** A fresh account with a signed-in client. */
export async function signUp(): Promise<SupabaseClient> {
  const { API_URL, PUBLISHABLE_KEY } = status();
  if (!API_URL || !PUBLISHABLE_KEY) {
    throw new Error("local Supabase is not running: supabase start");
  }

  const client = createClient(API_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signUp({ email: `${uuidv7()}@harness.local`, password: PASSWORD });
  if (error) {
    throw error;
  }
  return client;
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

  let remote = client && supabaseRemote(client);
  return {
    store,
    login: (c: SupabaseClient) => {
      remote = supabaseRemote(c);
    },
    sync: async () => {
      if (remote === undefined) {
        throw new Error("guest device has no remote");
      }
      await sync(store, remote);
    },
    count: async (table: Table) => (await db.all<{ n: number }>(`SELECT count(*) AS n FROM ${table}`, []))[0]?.n ?? 0,
    close: () => db.close(),
  };
}
