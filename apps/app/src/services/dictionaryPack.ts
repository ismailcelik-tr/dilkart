import type { SqlReader } from "@dilkart/core";
import { importDatabaseFromAssetAsync, openDatabaseAsync } from "expo-sqlite";

import { sqlDriver } from "@/drivers/sqlDriver";

// Copied from the bundled asset once; a new pack ships under a new name so it is copied again.
const DICTIONARY_DB = "dictionary-v1.sqlite";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DICTIONARY_ASSET: number = require("@/assets/dictionary/dictionary.sqlite");

let dictionary: Promise<SqlReader> | undefined;

export function openDictionary(): Promise<SqlReader> {
  // importDatabaseFromAssetAsync is what SQLiteProvider uses; the provider would tie the pack to one subtree.
  dictionary ??= importDatabaseFromAssetAsync(DICTIONARY_DB, { assetId: DICTIONARY_ASSET })
    .then(() => openDatabaseAsync(DICTIONARY_DB))
    .then(sqlDriver);
  return dictionary;
}
