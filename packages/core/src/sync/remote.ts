// RemoteApi over the sync RPCs. Typed structurally so core needs no supabase-js;
// a SupabaseClient satisfies RpcClient.
import { PermanentError, UpgradeRequired, type RemoteApi } from "./engine";
import type { Op, RemoteRow } from "./localStore";

export interface RpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: string; message: string } | null; status: number }>;
}

// Raised by sync_push; see supabase/migrations sync_rpc.
const UPGRADE_REQUIRED = "DK001";
const HTTP_BAD_REQUEST = 400;
const HTTP_SERVER_ERROR = 500;
// Client errors that a later retry can fix: expired session, timeout, rate limit.
const RETRYABLE = new Set([401, 408, 429]);

function failure(fn: string, error: { code?: string; message: string }, status: number): Error {
  if (error.code === UPGRADE_REQUIRED) {
    return new UpgradeRequired();
  }
  const permanent = status >= HTTP_BAD_REQUEST && status < HTTP_SERVER_ERROR && !RETRYABLE.has(status);
  const message = `${fn}: ${error.code ?? status} ${error.message}`;
  return permanent ? new PermanentError(message) : new Error(message);
}

/** `url` is the project API URL; its auth health endpoint supplies the server clock. */
export function rpcRemote(client: RpcClient, url: string, fetcher: typeof fetch = fetch): RemoteApi {
  const call = async (fn: string, args: Record<string, unknown>) => {
    const { data, error, status } = await client.rpc(fn, args);
    if (error) {
      throw failure(fn, error, status);
    }
    return data;
  };

  return {
    push: async (ops: Op[], schemaVersion: number) => {
      await call("sync_push", { ops, schema_version: schemaVersion });
    },
    pull: async (since: number, page: number) => (await call("sync_pull", { since, page })) as RemoteRow[],
    serverTime: async () => {
      const response = await fetcher(`${url}/auth/v1/health`, { method: "HEAD" });
      const date = response.headers.get("date");
      if (date === null) {
        throw new Error("server sent no Date header");
      }
      return Date.parse(date);
    },
  };
}
