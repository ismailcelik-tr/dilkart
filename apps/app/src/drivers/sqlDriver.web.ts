import type { SqlDriver, SqlExecutor } from "@dilkart/core";
import type { SQLiteDatabase } from "expo-sqlite";

import { executor } from "./sqlExecutor";

/** Web has no withExclusiveTransactionAsync; one queue keeps other statements out of a transaction. */
export function sqlDriver(db: SQLiteDatabase): SqlDriver {
  const direct = executor(db);
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    all: <T>(sql: string, params: unknown[]) => serial(() => direct.all<T>(sql, params)),
    run: (sql, params) => serial(() => direct.run(sql, params)),
    exec: (sql) => serial(() => direct.exec(sql)),
    transaction: <T>(fn: (tx: SqlExecutor) => Promise<T>) =>
      serial(async () => {
        await db.execAsync("BEGIN IMMEDIATE");
        try {
          const result = await fn(direct);
          await db.execAsync("COMMIT");
          return result;
        } catch (e) {
          await db.execAsync("ROLLBACK");
          throw e;
        }
      }),
  };
}
