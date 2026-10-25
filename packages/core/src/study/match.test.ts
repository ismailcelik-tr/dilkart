import { describe, expect, it } from "vitest";

import type { Card } from "../data/library";
import { MATCH_PAIRS, matchRound } from "./match";

const card = (i: number, tr = `k${i}`): Card => ({
  id: `c${i}`,
  deckId: "d",
  front: `w${i}`,
  meanings: [{ tr }, { tr: "ikincil" }],
  isWeak: false,
});

const cards = (n: number) => Array.from({ length: n }, (_, i) => card(i));

describe("matchRound", () => {
  it("needs at least four cards", () => {
    expect(matchRound(cards(3))).toBeUndefined();
    expect(matchRound(cards(4))?.left).toHaveLength(4);
  });

  it("takes six pairs from a larger deck", () => {
    const round = matchRound(cards(20));
    expect(round?.left).toHaveLength(MATCH_PAIRS);
    expect(new Set(round?.left.map((i) => i.cardId))).toEqual(new Set(round?.right.map((i) => i.cardId)));
  });

  it("pairs each front with its first meaning", () => {
    const round = matchRound(cards(6));
    for (const item of round?.right ?? []) {
      expect(item.text).toBe(`k${item.cardId.slice(1)}`);
    }
  });

  it("skips cards whose text would be ambiguous", () => {
    const deck = [card(0, "gitmek"), card(1, "Gitmek!"), card(2), card(3), card(4)];
    const round = matchRound(deck);
    expect(round?.right.filter((i) => i.text.toLowerCase().startsWith("gitmek"))).toHaveLength(1);
    expect(round?.left).toHaveLength(4);
  });

  it("shuffles each side independently", () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const round = matchRound(cards(6), random);
    expect(round?.left.map((i) => i.cardId)).not.toEqual(round?.right.map((i) => i.cardId));
  });
});
