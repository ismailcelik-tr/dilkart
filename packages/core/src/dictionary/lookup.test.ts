import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { beforeAll, describe, expect, it } from "vitest";

import { Direction, lookup, type Result, type SqlReader } from "./lookup";

// Built by tools/dictionary (dilkart_dict.fixture); the Python tests assert the same behavior.
const FIXTURE = new URL("../../../../spec/fixtures/dictionary.sqlite", import.meta.url);

let db: SqlReader;

beforeAll(() => {
  const conn = new DatabaseSync(FIXTURE, { readOnly: true });
  db = { all: async (sql, params) => conn.prepare(sql).all(...(params as SQLInputValue[])) as never };
});

const glosses = (results: Result[]) => results.flatMap((r) => r.senses.map((s) => s.gloss));
const headwords = (results: Result[]) => results.map((r) => r.headword);

describe("lookup", () => {
  it("merges sources without duplicates", async () => {
    const g = glosses(await lookup(db, "run", Direction.EnTr));
    expect(g.filter((x) => x === "koşmak")).toHaveLength(1);
    expect(g).toContain("işletmek");
  });

  it("keeps translation context", async () => {
    const [run] = await lookup(db, "run", Direction.EnTr);
    expect(run?.senses.find((s) => s.gloss === "işletmek")?.context).toBe("to manage");
  });

  it("uses WordNet for English definitions", async () => {
    const results = await lookup(db, "run", Direction.EnEn);
    expect(glosses(results.slice(0, 1))).toEqual(["move fast by using one's feet"]);
    expect(results[0]?.synonyms).toContain("scarper");
  });

  it("resolves English inflections to lemmas", async () => {
    expect(headwords(await lookup(db, "Went", Direction.EnTr))[0]).toBe("go");
    expect(headwords(await lookup(db, "ran", Direction.EnTr))[0]).toBe("run");
    expect(headwords(await lookup(db, "saw", Direction.EnTr))).toEqual(["see"]);
  });

  it("finds Turkish entries regardless of case", async () => {
    expect(glosses(await lookup(db, "KİTAP", Direction.TrEn))).toEqual(["book"]);
  });

  it.each([
    ["kitaplar", "kitap"],
    ["kitaplarim", "kitap"],
    ["kitabı", "kitap"],
    ["koşuyorum", "koşmak"],
    ["tutuyor", "tutmak"],
  ])("stems %s to %s", async (query, lemma) => {
    expect(headwords(await lookup(db, query, Direction.TrEn))[0]).toBe(lemma);
  });

  it("respects Turkish letters and skips proper names when stemming", async () => {
    expect(headwords(await lookup(db, "oluyor", Direction.TrEn))).toEqual(["olmak"]);
    expect(headwords(await lookup(db, "akan", Direction.TrEn))).toEqual(["akmak"]);
  });

  it("returns every lemma of the matching stem", async () => {
    expect(new Set(headwords(await lookup(db, "kurulması", Direction.TrEn)))).toEqual(new Set(["kurul", "kurulmak"]));
  });

  it("ranks the exact lowercase headword first", async () => {
    expect(headwords(await lookup(db, "friend", Direction.EnTr))[0]).toBe("friend");
  });

  it("prefers the shortest bilingual example", async () => {
    const [run] = await lookup(db, "run", Direction.EnTr);
    expect(run?.examples[0]).toEqual({ en: "Run!", tr: "Koş!" });
  });

  it("searches by prefix", async () => {
    expect(headwords(await lookup(db, "bo", Direction.EnTr, { prefix: true }))).toEqual(["book", "board"]);
  });

  it("returns nothing for empty queries", async () => {
    expect(await lookup(db, "  ", Direction.EnTr)).toEqual([]);
  });
});
