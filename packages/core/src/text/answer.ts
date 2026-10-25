// Typed-answer check for the typing and listening modules (plan 4A).
import { searchKey } from "./searchKey";

export enum Verdict {
  Correct = "correct",
  Almost = "almost",
  Wrong = "wrong",
}

export interface Check {
  verdict: Verdict;
  /** The accepted answer closest to the input, for showing the right spelling. */
  expected: string;
}

// One accepted string may list alternatives: "konuk, misafir".
const ALTERNATIVES = /[,;]/;
const INFINITIVE = /^to /;
// Typo budget: up to this many letters one edit, above it two.
const SHORT_WORD = 6;

/** Case, punctuation, spacing and accents never matter; a leading "to " is optional. */
const normalize = (text: string) => searchKey(text).replace(INFINITIVE, "");

export function checkAnswer(input: string, accepted: string[]): Check {
  const options = accepted.flatMap((a) => a.split(ALTERNATIVES)).map((a) => a.trim()).filter(Boolean);
  const typed = normalize(input);

  let best: Check = { verdict: Verdict.Wrong, expected: options[0] ?? "" };
  if (typed === "") {
    return best;
  }

  for (const option of options) {
    const target = normalize(option);
    if (typed === target) {
      return { verdict: Verdict.Correct, expected: option };
    }
    if (best.verdict === Verdict.Wrong && distance(typed, target) <= budget(target)) {
      best = { verdict: Verdict.Almost, expected: option };
    }
  }
  return best;
}

const budget = (target: string) => ([...target].length <= SHORT_WORD ? 1 : 2);

/** Optimal string alignment distance: Levenshtein plus adjacent transposition. */
function distance(a: string, b: string): number {
  const s = [...a];
  const t = [...b];
  const width = t.length + 1;
  const d = new Array<number>((s.length + 1) * width).fill(0);
  const at = (i: number, j: number) => d[i * width + j] ?? 0;

  for (let i = 0; i <= s.length; i++) {
    for (let j = 0; j <= t.length; j++) {
      if (i === 0 || j === 0) {
        d[i * width + j] = i + j;
        continue;
      }

      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let v = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        v = Math.min(v, at(i - 2, j - 2) + 1);
      }
      d[i * width + j] = v;
    }
  }
  return at(s.length, t.length);
}
