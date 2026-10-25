import { Library, LocalStore } from "@dilkart/core";
// Test-only helper; not part of the core package surface.
import { testDriver } from "@dilkart/core/src/sync/testDriver";

/** Real core library on in-memory node:sqlite. */
export async function testLibrary(): Promise<Library> {
  const db = testDriver();
  const store = new LocalStore(db);
  await store.open();
  return new Library(store, db);
}
