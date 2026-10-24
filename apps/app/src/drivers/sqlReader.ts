import type { SqlReader } from "@dilkart/core";
import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";

export function sqlReader(db: SQLiteDatabase): SqlReader {
  return {
    all: <T>(sql: string, params: unknown[]) => db.getAllAsync<T>(sql, params as SQLiteBindValue[]),
  };
}
