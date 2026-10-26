import { Library, LocalStore, RecentSearches, Settings, Study, type SqlReader, type UserSettings } from "@dilkart/core";
// Test-only helper; not part of the core package surface.
import { testDriver } from "@dilkart/core/src/sync/testDriver";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import type { AppData } from "@/services/openData";

const FIXTURE = `${__dirname}/../../../spec/fixtures/dictionary.sqlite`;

/** Real core on in-memory node:sqlite; the dictionary is the shared test fixture. */
/** `path` makes the database a file, so it survives close and reopen like a real one. */
export async function testData(changes: Partial<UserSettings> = {}, name = "test.sqlite", path?: string) {
  const db = testDriver(path);
  const store = new LocalStore(db);
  await store.open();
  const settings = new Settings(store);
  if (Object.keys(changes).length > 0) {
    await settings.set(changes);
  }
  const library = new Library(store, db);
  const pack = new DatabaseSync(FIXTURE, { readOnly: true });
  const reader: SqlReader = { all: async (sql, params) => pack.prepare(sql).all(...(params as SQLInputValue[])) as never };
  const data: AppData = {
    name,
    library,
    store,
    close: async () => db.close(),
    settings,
    study: new Study(store, library, db, settings),
    recent: new RecentSearches(db),
    dictionary: async () => reader,
  };
  return { ...data, store };
}
