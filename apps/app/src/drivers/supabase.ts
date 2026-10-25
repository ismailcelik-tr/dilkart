import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Storage } from "expo-sqlite/kv-store";

const URL_VAR = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY_VAR = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const supabaseUrl = URL_VAR ?? "";

/** Undefined in builds without a backend configured: the app then runs guest-only. */
export function createSupabase(): SupabaseClient | undefined {
  if (!URL_VAR || !KEY_VAR) {
    return undefined;
  }
  return createClient(URL_VAR, KEY_VAR, {
    auth: { storage: Storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}
