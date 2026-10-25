import type { SqlDriver, SqlExecutor } from "@dilkart/core";
import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";

function executor(db: SQLiteDatabase): SqlExecutor {
  return {
    all: <T>(sql: string, params: unknown[]) => db.getAllAsync<T>(sql, params as SQLiteBindValue[]),
    run: async (sql, params) => {
      await db.runAsync(sql, params as SQLiteBindValue[]);
    },
    exec: (sql) => db.execAsync(sql),
  };
}

/** Exclusive transactions run on their own connection, hence the `tx` executor. */
export function sqlDriver(db: SQLiteDatabase): SqlDriver {
  return {
    ...executor(db),
    transaction: async <T>(fn: (tx: SqlExecutor) => Promise<T>) => {
      let result: T | undefined;
      await db.withExclusiveTransactionAsync(async (txn) => {
        result = await fn(executor(txn));
      });
      return result as T;
    },
  };
}
