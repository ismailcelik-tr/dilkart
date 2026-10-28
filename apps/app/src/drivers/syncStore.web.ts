// expo-sqlite's sync calls block on its web worker and time out before it starts; localStorage does not.
const storage = () => (typeof localStorage === "undefined" ? undefined : localStorage);

/** Key-value reads that must not wait, e.g. before the first frame. */
export const syncStore = {
  get: (key: string): string | null => storage()?.getItem(key) ?? null,
  set: async (key: string, value: string): Promise<void> => storage()?.setItem(key, value),
};
