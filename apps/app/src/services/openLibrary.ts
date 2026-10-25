import { Library, LocalStore } from "@dilkart/core";
import { openDatabaseAsync } from "expo-sqlite";

import { sqlDriver } from "@/drivers/sqlDriver";

// Accounts get user_<uid>.sqlite in stage 7; until then everyone is a guest.
const GUEST_DB = "guest.sqlite";

export async function openLibrary(): Promise<Library> {
  const driver = sqlDriver(await openDatabaseAsync(GUEST_DB));
  const store = new LocalStore(driver);
  await store.open();
  return new Library(store, driver);
}
