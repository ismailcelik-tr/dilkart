import type { SQLiteDatabase } from "expo-sqlite";

import { sqlDriver } from "@/drivers/sqlDriver.web";

/** Records statements; each takes a tick, as the web worker does. */
function fakeDb() {
  const log: string[] = [];
  const step = async (sql: string) => {
    await new Promise((r) => setTimeout(r, 1));
    log.push(sql);
  };
  const db = {
    execAsync: step,
    runAsync: (sql: string) => step(sql),
    getAllAsync: async (sql: string) => {
      await step(sql);
      return [];
    },
  };
  return { db: db as unknown as SQLiteDatabase, log };
}

describe("web sqlDriver", () => {
  it("keeps other statements out of a transaction", async () => {
    const { db, log } = fakeDb();
    const driver = sqlDriver(db);

    const tx = driver.transaction(async (t) => {
      await t.run("INSERT a", []);
      await t.run("INSERT b", []);
    });
    const outside = driver.run("INSERT c", []);
    await Promise.all([tx, outside]);

    expect(log).toEqual(["BEGIN IMMEDIATE", "INSERT a", "INSERT b", "COMMIT", "INSERT c"]);
  });

  it("rolls back a failed transaction and keeps going", async () => {
    const { db, log } = fakeDb();
    const driver = sqlDriver(db);

    await expect(
      driver.transaction(async (t) => {
        await t.run("INSERT a", []);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await driver.run("INSERT c", []);

    expect(log).toEqual(["BEGIN IMMEDIATE", "INSERT a", "ROLLBACK", "INSERT c"]);
  });
});
