import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import type { SqlDriver } from "@dilkart/core";

/** node:sqlite stands in for expo-sqlite; a file path survives a simulated restart. */
export function nodeDriver(path = ":memory:"): SqlDriver & { close(): void } {
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
