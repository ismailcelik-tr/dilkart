// Turkish casing: toLowerCase() maps "I" to "i" and "İ" to "i" + combining dot.
const TR_UPPER: Record<string, string> = { I: "ı", İ: "i" };
const TR_FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

const COMBINING_MARKS = /\p{M}/gu;
const APOSTROPHES = /['’]/g;
const SEPARATORS = /[-‐_/]/g;
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

/** Language-independent lookup key; must match tools/dictionary normalize.search_key. */
export function searchKey(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[Iİ]/g, (c) => TR_UPPER[c] ?? c)
    .toLowerCase()
    .replace(/[çğıöşü]/g, (c) => TR_FOLD[c] ?? c)
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(APOSTROPHES, "")
    .replace(SEPARATORS, " ")
    .replace(PUNCTUATION, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}
