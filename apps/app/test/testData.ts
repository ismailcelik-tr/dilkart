import { DEFAULT_SETTINGS, Library, LocalStore, Study, type StudySettings } from "@dilkart/core";
// Test-only helper; not part of the core package surface.
import { testDriver } from "@dilkart/core/src/sync/testDriver";

import type { AppData } from "@/services/openData";

/** Real core library and study on in-memory node:sqlite. */
export async function testData(settings: StudySettings = DEFAULT_SETTINGS) {
  const db = testDriver();
  const store = new LocalStore(db);
  await store.open();
  const library = new Library(store, db);
  const data: AppData = { library, study: new Study(store, library, db, settings) };
  return { ...data, store };
}
