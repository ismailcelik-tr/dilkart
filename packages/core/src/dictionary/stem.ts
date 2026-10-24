// Query-time Turkish lemma guessing; mirrors tools/dictionary stem.py.

const MIN_STEM = 2;
// Final consonant softening before a vowel suffix: kitap → kitabı, git → gidiyor, ağaç → ağacı.
// "g" covers "ğ" in input typed without Turkish letters.
const HARDENED: Record<string, string> = { b: "p", c: "ç", d: "t", ğ: "k", g: "k" };
const INFINITIVES = ["mek", "mak"];
const PRESENT_CONTINUOUS = "yor";
// Vowels the present continuous inserts or narrows: tut-u-yor, söyle → söylü-yor.
const NARROW_VOWELS = "ıiuü";
const WIDE_VOWELS = ["e", "a"];
// Past tense with optional person/plural ending: ye-dim, gör-dük, bak-tılar.
const PAST_TENSE = /[dt][ıiuü](m|n|k|nız|niz|nuz|nüz|lar|ler)?$/;

function harden(stem: string): string[] {
  const last = stem.at(-1) ?? "";
  return last in HARDENED ? [stem.slice(0, -1) + HARDENED[last]] : [];
}

function verbRoots(word: string): string[] {
  const past = PAST_TENSE.exec(word);
  const hasPast = past !== null && past.index >= MIN_STEM;
  if (hasPast) {
    word = word.slice(0, past.index);
  }

  const i = word.indexOf(PRESENT_CONTINUOUS);
  if (i < MIN_STEM) {
    return hasPast ? [word] : [];
  }

  const base = word.slice(0, i);
  if (!NARROW_VOWELS.includes(base.at(-1) ?? "")) {
    return [base];
  }

  const root = base.slice(0, -1);
  return [base, root, ...harden(root), ...WIDE_VOWELS.map((v) => root + v)];
}

const withInfinitives = (bases: string[]) => bases.flatMap((b) => INFINITIVES.map((i) => b + i));

/** Lemma candidates for a lowercase Turkish word, one group per stem length, longest first. */
export function* turkishStems(word: string): Generator<string[]> {
  if (word.includes(" ") || word.length <= MIN_STEM) {
    return;
  }

  const roots = verbRoots(word);
  if (roots.length > 0) {
    yield withInfinitives(roots);
  }

  for (let n = word.length - 1; n >= MIN_STEM; n--) {
    const stem = word.slice(0, n);
    const bases = [stem, ...harden(stem)];
    yield [...bases, ...withInfinitives(bases)];
  }
}
