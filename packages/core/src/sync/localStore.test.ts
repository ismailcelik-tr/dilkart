import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { decode, encode } from "./hlc";
import { LOCAL_SCHEMA_VERSION, LocalStore, mappedColumns, SETTINGS_ID, Table } from "./localStore";
import { testDriver } from "./testDriver";

const NODE = "dev-a";
const DECK = "0199c1d2-0000-7000-8000-0000000000d1";
const CARD = "0199c1d2-0000-7000-8000-0000000000c1";
const LOG = "0199c1d2-0000-7000-8000-0000000000e1";

let now: number;
let store: LocalStore;

beforeEach(async () => {
  now = 1_000;
  store = new LocalStore(testDriver(), NODE, () => now);
  await store.open();
});

const ops = async () => (await store.pending(100)).map((p) => p.op);

describe("LocalStore.write", () => {
  it("updates the row and queues an op in one step", async () => {
    await store.write(Table.Decks, DECK, { name: "Fiiller" });
    expect(await store.read(Table.Decks, DECK)).toMatchObject({ id: DECK, name: "Fiiller" });

    const [op] = await ops();
    expect(op).toMatchObject({
      table: Table.Decks,
      row_id: DECK,
      values: { name: "Fiiller" },
      base: { name: null },
      hlc: encode({ wall: 1_000, counter: 0, node: NODE }),
    });
  });

  it("records the clock the writer saw as base", async () => {
    await store.write(Table.Decks, DECK, { name: "a" });
    await store.write(Table.Decks, DECK, { name: "b" });
    const [first, second] = await ops();
    expect(second?.base).toEqual({ name: first?.hlc });
  });

  it("round-trips json and boolean columns", async () => {
    await store.write(Table.Decks, DECK, { name: "d" });
    await store.write(Table.Cards, CARD, { deck_id: DECK, front: "go", meanings: [{ tr: "gitmek" }], is_weak: true });
    expect(await store.read(Table.Cards, CARD)).toMatchObject({ meanings: [{ tr: "gitmek" }], is_weak: true });
  });

  it("rejects unknown columns", async () => {
    await expect(store.write(Table.Decks, DECK, { color: "red" })).rejects.toThrow(/color/);
    expect(await ops()).toEqual([]);
  });
});

describe("LocalStore outbox", () => {
  it("acks up to a sequence", async () => {
    await store.write(Table.Decks, DECK, { name: "a" });
    await store.write(Table.Decks, DECK, { name: "b" });
    await store.write(Table.Decks, DECK, { name: "c" });
    const pending = await store.pending(2);
    await store.ack(pending[1]?.seq ?? 0);
    expect((await ops()).map((o) => o.values.name)).toEqual(["c"]);
  });

  it("queues review logs as insert-only ops", async () => {
    await store.append(LOG, { card_id: CARD, reviewed_at: "2026-10-25T06:00:00Z", rating: 3, mode: 1, tz_offset_min: 180, elapsed_ms: 900 });
    expect(await store.read(Table.ReviewLogs, LOG)).toMatchObject({ rating: 3 });
    expect((await ops())[0]).toMatchObject({ table: Table.ReviewLogs, row_id: LOG, base: {} });
  });

  it("stores whether a review counts for scheduling", async () => {
    await store.append(LOG, { card_id: CARD, reviewed_at: "2026-10-25T06:00:00Z", rating: 3, mode: 5, tz_offset_min: 180, elapsed_ms: 900, scheduled: false });
    expect(await store.read(Table.ReviewLogs, LOG)).toMatchObject({ scheduled: false });
  });
});

describe("LocalStore.applyRemote", () => {
  const remoteClock = encode({ wall: 5_000, counter: 0, node: "dev-b" });

  it("merges fields and keeps unsent local edits", async () => {
    await store.write(Table.Decks, DECK, { name: "d" });
    await store.write(Table.Cards, CARD, { deck_id: DECK, front: "local" });
    await store.applyRemote([
      {
        seq: 7,
        tbl: Table.Cards,
        data: {
          id: CARD, user_id: "u", deck_id: DECK, front: "remote", example_en: "Go!", server_seq: 7,
          field_clock: { front: encode({ wall: 10, counter: 0, node: "dev-b" }), example_en: remoteClock },
        },
      },
    ]);
    expect(await store.read(Table.Cards, CARD)).toMatchObject({ front: "local", example_en: "Go!" });
    expect(await store.cursor()).toBe(7);
  });

  it("moves the local clock past remote clocks", async () => {
    await store.applyRemote([
      { seq: 1, tbl: Table.Decks, data: { id: DECK, name: "r", field_clock: { name: remoteClock } } },
    ]);
    await store.write(Table.Decks, DECK, { name: "mine" });
    const [op] = await ops();
    expect(String(op?.hlc) > remoteClock).toBe(true);
    expect(op?.base).toEqual({ name: remoteClock });
  });

  it("inserts remote review logs once", async () => {
    const log = { seq: 3, tbl: Table.ReviewLogs, data: {
      id: LOG, user_id: "u", card_id: CARD, reviewed_at: "2026-10-25T06:00:00+00:00",
      rating: 4, mode: 2, tz_offset_min: 180, elapsed_ms: 700, server_seq: 3,
    } };
    await store.applyRemote([log]);
    await store.applyRemote([log]);
    expect(await store.read(Table.ReviewLogs, LOG)).toMatchObject({ rating: 4 });
    expect(await ops()).toEqual([]);
  });

  it("maps the settings row to the local singleton", async () => {
    await store.applyRemote([
      { seq: 2, tbl: Table.Settings, data: { user_id: "u", daily_new_limit: 15, field_clock: { daily_new_limit: remoteClock } } },
    ]);
    expect(await store.read(Table.Settings, SETTINGS_ID)).toMatchObject({ daily_new_limit: 15 });
  });

});

describe("LocalStore persistence", () => {
  it("keeps the outbox and clock across a reopen", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "dilkart-")), "user.sqlite");
    const first = testDriver(path);
    const a = new LocalStore(first, NODE, () => now);
    await a.open();
    await a.write(Table.Decks, DECK, { name: "kalıcı" });
    first.close();

    const b = new LocalStore(testDriver(path), NODE, () => now);
    await b.open();
    await b.write(Table.Decks, DECK, { name: "sonra" });
    const [before, after] = (await b.pending(10)).map((p) => p.op);
    expect(before?.values.name).toBe("kalıcı");
    expect(String(after?.hlc) > String(before?.hlc)).toBe(true);
  });
});

describe("LocalStore migrations", () => {
  type Column = { name: string };

  it("brings a new database to the latest version", async () => {
    const db = testDriver();
    await new LocalStore(db, NODE).open();
    const [{ user_version } = { user_version: 0 }] = await db.all<{ user_version: number }>("PRAGMA user_version", []);
    expect(user_version).toBe(LOCAL_SCHEMA_VERSION);
  });

  it("creates every column the store maps", async () => {
    const db = testDriver();
    await new LocalStore(db, NODE).open();
    for (const [table, columns] of Object.entries(mappedColumns())) {
      const actual = (await db.all<Column>(`PRAGMA table_info(${table})`, [])).map((c) => c.name);
      expect(actual).toEqual(expect.arrayContaining(columns));
    }
  });

  it("upgrades an older database without losing rows", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "dilkart-")), "user.sqlite");
    const old = testDriver(path);
    const a = new LocalStore(old, NODE);
    await a.open();
    await a.write(Table.Decks, DECK, { name: "eski" });
    await old.exec("DROP INDEX cards_deck; PRAGMA user_version = 1");
    old.close();

    const db = testDriver(path);
    const b = new LocalStore(db, NODE);
    await b.open();
    expect(await b.read(Table.Decks, DECK)).toMatchObject({ name: "eski" });
    const indexes = (await db.all<Column>("PRAGMA index_list(cards)", [])).map((c) => c.name);
    expect(indexes).toContain("cards_deck");
  });
});

describe("LocalStore node id", () => {
  it("creates one per database and keeps it", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "dilkart-")), "user.sqlite");
    const first = testDriver(path);
    const a = new LocalStore(first, undefined, () => now);
    await a.open();
    await a.write(Table.Decks, DECK, { name: "a" });
    first.close();

    const b = new LocalStore(testDriver(path), undefined, () => now);
    await b.open();
    await b.write(Table.Decks, DECK, { name: "b" });
    const [x, y] = (await b.pending(10)).map((p) => decode(p.op.hlc).node);
    expect(x).toMatch(/^[0-9a-f-]{36}$/);
    expect(y).toBe(x);
  });
});
