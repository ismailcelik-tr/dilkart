import { Storage } from "expo-sqlite/kv-store";

/** Key-value reads that must not wait, e.g. before the first frame. */
export const syncStore = {
  get: (key: string): string | null => Storage.getItemSync(key),
  set: (key: string, value: string): Promise<void> => Storage.setItem(key, value),
};
