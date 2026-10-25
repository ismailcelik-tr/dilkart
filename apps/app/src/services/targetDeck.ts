import type { Deck, Library } from "@dilkart/core";

import { lastDeck } from "./prefs";

// Plan section 16: with no deck used yet, dictionary cards go to this deck.
const FALLBACK_DECK = "Sözlükten";

/** The last used live deck; otherwise the fallback deck, created if needed. */
export async function targetDeck(lib: Library): Promise<Deck> {
  const decks = await lib.decks();
  const last = await lastDeck();
  const found = decks.find((d) => d.id === last) ?? decks.find((d) => d.name === FALLBACK_DECK);
  if (found !== undefined) {
    return found;
  }

  const created = await lib.createDeck(FALLBACK_DECK);
  if (!created.ok) {
    throw new Error("fallback deck");
  }
  return { id: created.id, name: FALLBACK_DECK, cardCount: 0 };
}
