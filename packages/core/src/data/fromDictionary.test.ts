import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { Direction, lookup, type Result, type SqlReader } from "../dictionary/lookup";
import { LocalStore } from "../sync/localStore";
import { testDriver } from "../sync/testDriver";
import { Library } from "./library";
import { RecentSearches } from "./recent";

const FIXTURE = new URL("../../../../spec/fixtures/dictionary.sqlite", import.meta.url);
const conn = new DatabaseSync(FIXTURE, { readOnly: true });
const dict: SqlReader = { all: async (sql, params) => conn.prepare(sql).all(...(params as SQLInputValue[])) as never };

let now: number;
let lib: Library;
let recent: RecentSearches;
let deck: string;

beforeEach(async () => {
  now = Date.parse("2026-10-25T09:00:00Z");
  const db = testDriver();
  const store = new LocalStore(db, "dev", () => now);
  await store.open();
  lib = new Library(store, db, () => now);
  recent = new RecentSearches(db, () => now);
  const created = await lib.createDeck("Fiiller");
  deck = created.ok ? created.id : "";
});

function must<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("missing");
  }
  return value;
}

async function first(query: string, direction: Direction): Promise<Result> {
  const [r] = await lookup(dict, query, direction);
  if (r === undefined) {
    throw new Error(`no result for ${query}`);
  }
  return r;
}

describe("Library.addFromDictionary", () => {
  it("makes an English-front card from an EN→TR sense", async () => {
    const run = await first("run", Direction.EnTr);
    const sense = must(run.senses.find((s) => s.gloss === "işletmek"));
    const saved = await lib.addFromDictionary(deck, run, sense.id, Direction.EnTr);

    expect(saved.ok).toBe(true);
    const card = saved.ok ? await lib.card(saved.id) : undefined;
    expect(card).toMatchObject({
      deckId: deck,
      front: "run",
      meanings: [{ tr: "işletmek", pos: "verb" }],
      dictEntryId: String(run.id),
      dictSenseId: String(sense.id),
    });
  });

  it("puts the English side in front for TR→EN", async () => {
    const kitap = await first("kitap", Direction.TrEn);
    const saved = await lib.addFromDictionary(deck, kitap, must(kitap.senses[0]).id, Direction.TrEn);
    const card = saved.ok ? await lib.card(saved.id) : undefined;
    const [example] = kitap.examples;
    expect(card).toMatchObject({ front: "book", meanings: [{ tr: "kitap" }], exampleEn: example?.en, exampleTr: example?.tr });
  });

  it("refuses a second card for the same sense", async () => {
    const run = await first("run", Direction.EnTr);
    const senseId = must(run.senses[0]).id;
    const saved = await lib.addFromDictionary(deck, run, senseId, Direction.EnTr);
    const again = await lib.addFromDictionary(deck, run, senseId, Direction.EnTr);

    expect(again).toEqual({ ok: false, duplicateOf: expect.objectContaining({ id: saved.ok ? saved.id : "" }) });
    expect(await lib.cards(deck)).toHaveLength(1);
  });

  it("allows the sense again once its card is deleted", async () => {
    const run = await first("run", Direction.EnTr);
    const senseId = must(run.senses[0]).id;
    const saved = await lib.addFromDictionary(deck, run, senseId, Direction.EnTr);
    await lib.removeCard(saved.ok ? saved.id : "");
    expect((await lib.addFromDictionary(deck, run, senseId, Direction.EnTr)).ok).toBe(true);
  });
});

describe("RecentSearches", () => {
  it("lists newest first without duplicates", async () => {
    await recent.add("run", Direction.EnTr);
    now += 1_000;
    await recent.add("kitap", Direction.TrEn);
    now += 1_000;
    await recent.add("Run ", Direction.EnTr);

    expect(await recent.list()).toEqual([
      { query: "Run", direction: Direction.EnTr },
      { query: "kitap", direction: Direction.TrEn },
    ]);
  });

  it("keeps the latest twenty", async () => {
    for (let i = 0; i < 25; i++) {
      now += 1_000;
      await recent.add(`w${i}`, Direction.EnEn);
    }
    const list = await recent.list();
    expect(list).toHaveLength(20);
    expect(list[0]?.query).toBe("w24");
  });

  it("clears", async () => {
    await recent.add("run", Direction.EnTr);
    await recent.clear();
    expect(await recent.list()).toEqual([]);
  });
});
