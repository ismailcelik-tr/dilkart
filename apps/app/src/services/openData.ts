import { Library, LocalStore, RecentSearches, Settings, Stats, Study, WeakWords, type SqlReader } from "@dilkart/core";
import { deleteDatabaseAsync, openDatabaseAsync } from "expo-sqlite";

import { sqlDriver } from "@/drivers/sqlDriver";

import { GUEST_DB } from "./databases";
import { openDictionary } from "./dictionaryPack";

export interface AppData {
  /** Database file name. */
  name: string;
  library: Library;
  settings: Settings;
  study: Study;
  weak: WeakWords;
  stats: Stats;
  recent: RecentSearches;
  store: LocalStore;
  /** Opened on first use: the first copy of the 106 MB pack should not delay app start. */
  dictionary: () => Promise<SqlReader>;
  /** Idempotent. */
  close: () => Promise<void>;
}

export async function openData(name: string = GUEST_DB): Promise<AppData> {
  const db = await openDatabaseAsync(name);
  const driver = sqlDriver(db);
  const store = new LocalStore(driver);
  await store.open();
  const library = new Library(store, driver);
  const settings = new Settings(store);
  let closed = false;
  return {
    name,
    library,
    settings,
    study: new Study(store, library, driver, settings),
    weak: new WeakWords(store, library),
    stats: new Stats(store, library, settings),
    recent: new RecentSearches(driver),
    store,
    dictionary: openDictionary,
    close: async () => {
      if (!closed) {
        closed = true;
        await db.closeAsync();
      }
    },
  };
}

export const deleteData = (name: string) => deleteDatabaseAsync(name);
