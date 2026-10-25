// supabase-js side of RemoteApi. Moves to apps/app/src/drivers in stage 7.
import { UpgradeRequired, type Op, type RemoteApi, type RemoteRow } from "@dilkart/core";
import type { SupabaseClient } from "@supabase/supabase-js";

// Raised by sync_push; see supabase/migrations sync_rpc.
const UPGRADE_REQUIRED = "DK001";

export function supabaseRemote(client: SupabaseClient): RemoteApi {
  return {
    async push(ops: Op[], schemaVersion: number) {
      const { error } = await client.rpc("sync_push", { ops, schema_version: schemaVersion });
      if (error?.code === UPGRADE_REQUIRED) {
        throw new UpgradeRequired();
      }
      if (error) {
        throw new Error(`sync_push: ${error.message}`);
      }
    },

    async pull(since: number, page: number) {
      const { data, error } = await client.rpc("sync_pull", { since, page });
      if (error) {
        throw new Error(`sync_pull: ${error.message}`);
      }
      return data as RemoteRow[];
    },
  };
}
