import { Library, LocalStore, Study } from "@dilkart/core";
import { openDatabaseAsync } from "expo-sqlite";

import { sqlDriver } from "@/drivers/sqlDriver";

// Accounts get user_<uid>.sqlite in stage 7; until then everyone is a guest.
const GUEST_DB = "guest.sqlite";

export interface AppData {
  library: Library;
  study: Study;
}

export async function openData(): Promise<AppData> {
  const driver = sqlDriver(await openDatabaseAsync(GUEST_DB));
  const store = new LocalStore(driver);
  await store.open();
  const library = new Library(store, driver);
  // Settings screen arrives in stage 8; until then study uses the defaults.
  return { library, study: new Study(store, library, driver) };
}
