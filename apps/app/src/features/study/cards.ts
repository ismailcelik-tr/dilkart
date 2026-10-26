import { SessionKind, type Card, type Library, type WeakWords } from "@dilkart/core";

/** Cards a practice sitting draws from: the weak list, one deck, or every deck. */
export function practiceCards(lib: Library, weak: WeakWords, kind: SessionKind, deckId?: string): Promise<Card[]> {
  if (kind === SessionKind.Weak) {
    return weak.cards();
  }
  return deckId === undefined ? lib.allCards() : lib.cards(deckId);
}
