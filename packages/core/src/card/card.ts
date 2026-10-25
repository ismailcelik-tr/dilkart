import { searchKey } from "../text/searchKey";

export interface Meaning {
  tr: string;
  pos?: string;
}

export interface CardDraft {
  front: string;
  meanings: Meaning[];
  usageLabel?: string;
  exampleEn?: string;
  exampleTr?: string;
  dictEntryId?: string;
  dictSenseId?: string;
}

export enum CardError {
  EmptyFront = "empty_front",
  NoMeaning = "no_meaning",
}

export type Validation = { ok: true; card: CardDraft } | { ok: false; errors: CardError[] };

const clean = (text: string | undefined) => text?.trim() || undefined;

export function validate(draft: CardDraft): Validation {
  const front = draft.front.trim();
  const meanings = draft.meanings
    .map((m) => ({ ...m, tr: m.tr.trim() }))
    .filter((m) => m.tr !== "");

  const errors: CardError[] = [];
  if (front === "") {
    errors.push(CardError.EmptyFront);
  }
  if (meanings.length === 0) {
    errors.push(CardError.NoMeaning);
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const card: CardDraft = {
    ...draft,
    front,
    meanings,
    usageLabel: clean(draft.usageLabel),
    exampleEn: clean(draft.exampleEn),
    exampleTr: clean(draft.exampleTr),
  };
  return { ok: true, card };
}

/** Same dictionary sense, or for manual cards the same normalized front and usage label. */
export function findDuplicate<T extends CardDraft>(draft: CardDraft, cards: T[]): T | undefined {
  if (draft.dictSenseId !== undefined) {
    return cards.find((c) => c.dictSenseId === draft.dictSenseId);
  }

  const key = manualKey(draft);
  return cards.find((c) => c.dictSenseId === undefined && manualKey(c) === key);
}

const manualKey = (c: CardDraft) => `${searchKey(c.front)}\u0000${searchKey(c.usageLabel ?? "")}`;
