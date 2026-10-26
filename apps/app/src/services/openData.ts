import { Library, LocalStore, RecentSearches, Settings, Study, WeakWords, type SqlReader } from "@dilkart/core";
import { deleteDatabaseAsync, importDatabaseFromAssetAsync, openDatabaseAsync } from "expo-sqlite";

import { sqlDriver } from "@/drivers/sqlDriver";

import { GUEST_DB } from "./databases";

// Copied from the bundled asset once; a new pack ships under a new name so it is copied again.
const DICTIONARY_DB = "dictionary-v1.sqlite";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DICTIONARY_ASSET: number = require("@/assets/dictionary/dictionary.sqlite");

export interface AppData {
  /** Database file name. */
  name: string;
  library: Library;
  settings: Settings;
  study: Study;
  weak: WeakWords;
  recent: RecentSearches;
  store: LocalStore;
  /** Opened on first use: the first copy of the 106 MB pack should not delay app start. */
  dictionary: () => Promise<SqlReader>;
  /** Idempotent. */
  close: () => Promise<void>;
}

let dictionary: Promise<SqlReader> | undefined;

function openDictionary(): Promise<SqlReader> {
  // importDatabaseFromAssetAsync is what SQLiteProvider uses; the provider would tie the pack to one subtree.
  dictionary ??= importDatabaseFromAssetAsync(DICTIONARY_DB, { assetId: DICTIONARY_ASSET })
    .then(() => openDatabaseAsync(DICTIONARY_DB))
    .then(sqlDriver);
  return dictionary;
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
