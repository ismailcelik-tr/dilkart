import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import type { SqlDriver } from "./localStore";

/** node:sqlite stand-in for expo-sqlite in tests. */
export function testDriver(path = ":memory:"): SqlDriver & { close(): void } {
  const conn = new DatabaseSync(path);
  return {
    all: async (sql, params) => conn.prepare(sql).all(...(params as SQLInputValue[])) as never,
    run: async (sql, params) => {
      conn.prepare(sql).run(...(params as SQLInputValue[]));
    },
    exec: async (sql) => conn.exec(sql),
    transaction: async (fn) => {
      conn.exec("BEGIN");
      try {
        const result = await fn();
        conn.exec("COMMIT");
        return result;
      } catch (e) {
        conn.exec("ROLLBACK");
        throw e;
      }
    },
    close: () => conn.close(),
  };
}
