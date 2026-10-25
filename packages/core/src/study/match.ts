// Matching module round: English fronts against first Turkish meanings. Practice only.
import type { Card } from "../data/library";
import { searchKey } from "../text/searchKey";

export const MATCH_PAIRS = 6;
export const MATCH_MIN_CARDS = 4;

export interface MatchItem {
  cardId: string;
  text: string;
}

export interface MatchRound {
  left: MatchItem[];
  right: MatchItem[];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Undefined when fewer than MATCH_MIN_CARDS cards have distinct fronts and meanings. */
export function matchRound(cards: Card[], random: () => number = Math.random): MatchRound | undefined {
  const seen = new Set<string>();
  const picked: Card[] = [];
  for (const card of shuffle(cards, random)) {
    const front = `en:${searchKey(card.front)}`;
    const meaning = `tr:${searchKey(card.meanings[0]?.tr ?? "")}`;
    if (seen.has(front) || seen.has(meaning)) {
      continue;
    }
    seen.add(front).add(meaning);
    picked.push(card);
    if (picked.length === MATCH_PAIRS) {
      break;
    }
  }
  if (picked.length < MATCH_MIN_CARDS) {
    return undefined;
  }

  return {
    left: picked.map((c) => ({ cardId: c.id, text: c.front })),
    right: shuffle(picked, random).map((c) => ({ cardId: c.id, text: c.meanings[0]?.tr ?? "" })),
  };
}
