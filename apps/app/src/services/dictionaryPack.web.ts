import type { SqlReader } from "@dilkart/core";

// The 106 MB pack stays out of the web build; web has no dictionary (ADR 0010).
export function openDictionary(): Promise<SqlReader> {
  return Promise.reject(new Error("no dictionary on web"));
}
