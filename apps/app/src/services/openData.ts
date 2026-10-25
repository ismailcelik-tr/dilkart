import { Library, LocalStore, RecentSearches, Study, type SqlReader } from "@dilkart/core";
import { importDatabaseFromAssetAsync, openDatabaseAsync } from "expo-sqlite";

import { sqlDriver } from "@/drivers/sqlDriver";

// Accounts get user_<uid>.sqlite in stage 7; until then everyone is a guest.
const GUEST_DB = "guest.sqlite";
// Copied from the bundled asset once; a new pack ships under a new name so it is copied again.
const DICTIONARY_DB = "dictionary-v1.sqlite";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DICTIONARY_ASSET: number = require("@/assets/dictionary/dictionary.sqlite");

export interface AppData {
  library: Library;
  study: Study;
  recent: RecentSearches;
  /** Opened on first use: the first copy of the 106 MB pack should not delay app start. */
  dictionary: () => Promise<SqlReader>;
}

let dictionary: Promise<SqlReader> | undefined;

function openDictionary(): Promise<SqlReader> {
  // importDatabaseFromAssetAsync is what SQLiteProvider uses; the provider would tie the pack to one subtree.
  dictionary ??= importDatabaseFromAssetAsync(DICTIONARY_DB, { assetId: DICTIONARY_ASSET })
    .then(() => openDatabaseAsync(DICTIONARY_DB))
    .then(sqlDriver);
  return dictionary;
}

export async function openData(): Promise<AppData> {
  const driver = sqlDriver(await openDatabaseAsync(GUEST_DB));
  const store = new LocalStore(driver);
  await store.open();
  const library = new Library(store, driver);
  // Settings screen arrives in stage 8; until then study uses the defaults.
  return { library, study: new Study(store, library, driver), recent: new RecentSearches(driver), dictionary: openDictionary };
}
