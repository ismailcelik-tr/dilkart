// Lookup over the offline dictionary pack; mirrors tools/dictionary lookup.py.
import { searchKey } from "../text/searchKey";
import { turkishLower } from "../text/turkishLower";
import { englishAdverbBases, turkishStems } from "./stem";

export enum Direction {
  EnTr = "en-tr",
  TrEn = "tr-en",
  EnEn = "en-en",
}

/** Minimal driver surface; expo-sqlite in the app, node:sqlite in tests. */
export interface SqlReader {
  all<T>(sql: string, params: unknown[]): Promise<T[]>;
}

export interface Sense {
  id: number;
  gloss: string;
  context: string | null;
}

export interface Result {
  id: number;
  headword: string;
  pos: string | null;
  senses: Sense[];
  examples: { en: string; tr: string | null }[];
  synonyms: string[];
}

export interface LookupOptions {
  prefix?: boolean;
  limit?: number;
}

type Lang = "en" | "tr";
type Ranked = { id: number; headword: string; n: number; rank: number };

const DEFAULT_LIMIT = 20;
// Upper bound for a key prefix range scan.
const MAX_CHAR = "\u{10FFFF}";
const LANGS: Record<Direction, [Lang, Lang]> = {
  [Direction.EnTr]: ["en", "tr"],
  [Direction.TrEn]: ["tr", "en"],
  [Direction.EnEn]: ["en", "en"],
};

const HAS_TARGET = "EXISTS (SELECT 1 FROM senses s WHERE s.entry_id = e.id AND s.target = ?)";
const RANKED =
  "SELECT e.id AS id, e.headword AS headword, e.rank AS rank," +
  " (SELECT count(*) FROM senses s WHERE s.entry_id = e.id AND s.target = ?) AS n FROM entries e";

const startsLower = (word: string) => /^\p{Ll}/u.test(word);

/** Exact spelling first, then lowercase headwords (proper names last), then page order, then richer entries. */
function rank(query: string, rows: Ranked[]): number[] {
  const typed = query.trim();
  const score = (r: Ranked) => [Number(r.headword !== typed), Number(!startsLower(r.headword)), r.rank, -r.n, r.id];
  return rows
    .filter((r) => r.n > 0)
    .map((r) => ({ id: r.id, score: score(r) }))
    .sort((a, b) => compareTuples(a.score, b.score))
    .map((r) => r.id);
}

function compareTuples(a: number[], b: number[]): number {
  for (let k = 0; k < a.length; k++) {
    const d = (a[k] ?? 0) - (b[k] ?? 0);
    if (d !== 0) {
      return d;
    }
  }
  return 0;
}

async function entryIds(
  db: SqlReader,
  query: string,
  key: string,
  [lang, target]: [Lang, Lang],
  prefix: boolean,
  limit: number,
): Promise<number[]> {
  if (prefix) {
    const rows = await db.all<{ id: number }>(
      `SELECT e.id AS id FROM entries e WHERE e.lang = ? AND e.key >= ? AND e.key < ? AND ${HAS_TARGET}` +
        " ORDER BY length(e.key), e.key, e.id LIMIT ?",
      [lang, key, key + MAX_CHAR, target, limit],
    );
    return rows.map((r) => r.id);
  }

  const exact = await db.all<Ranked>(`${RANKED} WHERE e.lang = ? AND e.key = ?`, [target, lang, key]);
  const lemmas = await db.all<Ranked>(
    `${RANKED} WHERE e.id IN (SELECT entry_id FROM forms WHERE key = ?) AND e.lang = ?`,
    [target, key, lang],
  );
  return [...new Set([...rank(query, exact), ...rank(query, lemmas)])].slice(0, limit);
}

/** All lemmas of the longest matching stem; exact Turkish letters first, then folded. */
async function stemmedIds(db: SqlReader, query: string, target: Lang, limit: number): Promise<number[]> {
  const word = turkishLower(query);
  for (const strict of [true, false]) {
    for (const group of turkishStems(word)) {
      const ids: number[] = [];
      for (const candidate of group) {
        const rows = await db.all<{ id: number; headword: string }>(
          `SELECT e.id AS id, e.headword AS headword FROM entries e WHERE e.lang = 'tr' AND e.key = ? AND ${HAS_TARGET}` +
            " ORDER BY e.id",
          [searchKey(candidate), target],
        );
        // Capitalized headwords are proper names; a stem rarely means a name.
        ids.push(
          ...rows
            .filter((r) => startsLower(r.headword) && (!strict || turkishLower(r.headword) === candidate))
            .map((r) => r.id),
        );
      }
      if (ids.length > 0) {
        return [...new Set(ids)].slice(0, limit);
      }
    }
  }
  return [];
}

/** Falls back from an unknown -ly adverb to its adjective. */
async function adverbIds(db: SqlReader, query: string, target: Lang, limit: number): Promise<number[]> {
  for (const base of englishAdverbBases(searchKey(query))) {
    const rows = await db.all<Ranked>(`${RANKED} WHERE e.lang = 'en' AND e.key = ?`, [target, base]);
    const ids = rank(base, rows);
    if (ids.length > 0) {
      return ids.slice(0, limit);
    }
  }
  return [];
}

async function result(db: SqlReader, id: number, target: Lang): Promise<Result> {
  const [entry] = await db.all<{ headword: string; pos: string | null }>(
    "SELECT headword, pos FROM entries WHERE id = ?",
    [id],
  );
  const senses = await db.all<Sense>(
    "SELECT id, gloss, context FROM senses WHERE entry_id = ? AND target = ? ORDER BY ord",
    [id, target],
  );
  const examples = await db.all<{ en: string; tr: string | null }>(
    "SELECT en, tr FROM examples WHERE entry_id = ? ORDER BY ord",
    [id],
  );
  const synonyms = await db.all<{ word: string }>("SELECT word FROM relations WHERE entry_id = ? AND kind = 'syn'", [
    id,
  ]);
  if (!entry) {
    throw new Error(`dictionary entry ${id} missing`);
  }

  return {
    id,
    headword: entry.headword,
    pos: entry.pos,
    senses: senses.map((s) => ({ ...s })),
    examples: examples.map((e) => ({ ...e })),
    synonyms: synonyms.map((s) => s.word),
  };
}

export async function lookup(
  db: SqlReader,
  query: string,
  direction: Direction,
  { prefix = false, limit = DEFAULT_LIMIT }: LookupOptions = {},
): Promise<Result[]> {
  const key = searchKey(query);
  if (!key) {
    return [];
  }

  const [lang, target] = LANGS[direction];
  let ids = await entryIds(db, query, key, [lang, target], prefix, limit);
  if (ids.length === 0 && lang === "tr" && !prefix) {
    ids = await stemmedIds(db, query, target, limit);
  }
  if (ids.length === 0 && lang === "en" && !prefix) {
    ids = await adverbIds(db, query, target, limit);
  }
  return Promise.all(ids.map((id) => result(db, id, target)));
}
