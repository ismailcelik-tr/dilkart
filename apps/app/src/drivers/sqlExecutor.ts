import type { SqlExecutor } from "@dilkart/core";
import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";

export function executor(db: SQLiteDatabase): SqlExecutor {
  return {
    all: <T>(sql: string, params: unknown[]) => db.getAllAsync<T>(sql, params as SQLiteBindValue[]),
    run: async (sql, params) => {
      await db.runAsync(sql, params as SQLiteBindValue[]);
    },
    exec: (sql) => db.execAsync(sql),
  };
}
