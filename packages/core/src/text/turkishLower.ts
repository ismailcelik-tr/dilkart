// Turkish casing: toLowerCase() maps "I" to "i" and "İ" to "i" + combining dot.
const TR_UPPER: Record<string, string> = { I: "ı", İ: "i" };
const CIRCUMFLEX = /̂/g;

/** Lowercase keeping Turkish letters (ç ğ ı ö ş ü); drops circumflex (â î û); must match tools/dictionary. */
export function turkishLower(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[Iİ]/g, (c) => TR_UPPER[c] ?? c)
    .toLowerCase()
    .normalize("NFD")
    .replace(CIRCUMFLEX, "")
    .normalize("NFC")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}
