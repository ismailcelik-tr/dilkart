import type { SqlDriver, SqlExecutor } from "@dilkart/core";
import type { SQLiteDatabase } from "expo-sqlite";

import { executor } from "./sqlExecutor";

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
