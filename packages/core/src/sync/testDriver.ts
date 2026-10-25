import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import type { SqlDriver, SqlExecutor } from "./localStore";

/**
 * node:sqlite stand-in for expo-sqlite in tests. Like expo-sqlite's exclusive
 * transactions, statements inside a transaction must go through its executor.
 */
export function testDriver(path = ":memory:"): SqlDriver & { close(): void } {
  const conn = new DatabaseSync(path);
  let inTransaction = false;

  const executor = (guarded: boolean): SqlExecutor => {
    const check = () => {
      if (guarded && inTransaction) {
        throw new Error("statement outside the open transaction");
      }
    };
    return {
      all: async (sql, params) => {
        check();
        return conn.prepare(sql).all(...(params as SQLInputValue[])) as never;
      },
      run: async (sql, params) => {
        check();
        conn.prepare(sql).run(...(params as SQLInputValue[]));
      },
      exec: async (sql) => {
        check();
        conn.exec(sql);
      },
    };
  };

  return {
    ...executor(true),
    transaction: async (fn) => {
      if (inTransaction) {
        throw new Error("nested transaction");
      }
      inTransaction = true;
      conn.exec("BEGIN");
      try {
        const result = await fn(executor(false));
        conn.exec("COMMIT");
        return result;
      } catch (e) {
        conn.exec("ROLLBACK");
        throw e;
      } finally {
        inTransaction = false;
      }
    },
    close: () => conn.close(),
  };
}
