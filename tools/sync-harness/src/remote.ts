// supabase-js side of RemoteApi. Moves to apps/app/src/drivers in stage 7.
import { PermanentError, UpgradeRequired, type Op, type RemoteApi, type RemoteRow } from "@dilkart/core";
import type { SupabaseClient } from "@supabase/supabase-js";

// Raised by sync_push; see supabase/migrations sync_rpc.
const UPGRADE_REQUIRED = "DK001";
const HTTP_BAD_REQUEST = 400;
const HTTP_SERVER_ERROR = 500;
// Client errors that a later retry can fix: expired session, timeout, rate limit.
const RETRYABLE = new Set([401, 408, 429]);

function failure(where: string, error: { code?: string; message: string }, status: number): Error {
  if (error.code === UPGRADE_REQUIRED) {
    return new UpgradeRequired();
  }
  const permanent = status >= HTTP_BAD_REQUEST && status < HTTP_SERVER_ERROR && !RETRYABLE.has(status);
  const message = `${where}: ${error.code ?? status} ${error.message}`;
  return permanent ? new PermanentError(message) : new Error(message);
}

export function supabaseRemote(client: SupabaseClient, url: string): RemoteApi {
  return {
    async push(ops: Op[], schemaVersion: number) {
      const { error, status } = await client.rpc("sync_push", { ops, schema_version: schemaVersion });
      if (error) {
        throw failure("sync_push", error, status);
      }
    },

    async pull(since: number, page: number) {
      const { data, error, status } = await client.rpc("sync_pull", { since, page });
      if (error) {
        throw failure("sync_pull", error, status);
      }
      return data as RemoteRow[];
    },

    async serverTime() {
      const response = await fetch(`${url}/auth/v1/health`, { method: "HEAD" });
      const date = response.headers.get("date");
      if (date === null) {
        throw new Error("server sent no Date header");
      }
      return Date.parse(date);
    },
  };
}
