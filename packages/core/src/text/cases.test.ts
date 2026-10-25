import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { Direction, lookup, type SqlReader } from "../dictionary/lookup";
import { turkishStems } from "../dictionary/stem";
import { searchKey } from "./searchKey";
import { turkishLower } from "./turkishLower";

// Shared with tools/dictionary tests/test_text_cases.py.
const CASES: {
  lower: [string, string][];
  key: [string, string][];
  stem: [string, string][];
  lemma: [string, Direction, string][];
} = JSON.parse(readFileSync(new URL("../../../../spec/text-cases.json", import.meta.url), "utf8"));

const FIXTURE = new URL("../../../../spec/fixtures/dictionary.sqlite", import.meta.url);
const conn = new DatabaseSync(FIXTURE, { readOnly: true });
const db: SqlReader = { all: async (sql, params) => conn.prepare(sql).all(...(params as SQLInputValue[])) as never };

describe("text cases (plan 4A)", () => {
  it.each(CASES.lower)("lower %j → %j", (text, expected) => {
    expect(turkishLower(text)).toBe(expected);
  });

  it.each(CASES.key)("key %j = %j", (a, b) => {
    expect(searchKey(a)).toBe(searchKey(b));
  });

  it.each(CASES.stem)("stem %j ∋ %j", (word, stem) => {
    expect([...turkishStems(word)].flat()).toContain(stem);
  });

  it.each(CASES.lemma)("lemma %j (%s) → %j", async (query, direction, headword) => {
    expect((await lookup(db, query, direction))[0]?.headword).toBe(headword);
  });
});
