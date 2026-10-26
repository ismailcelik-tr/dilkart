// Guest data joining an account (plan section 7; merge rules decided 25 Oct 2026).
import { findDuplicate, type CardDraft } from "../card/card";
import { SETTINGS_ID, Table, type Edit, type LocalStore } from "../sync/localStore";
import type { Values } from "../sync/merge";
import { searchKey } from "../text/searchKey";

const LIVE = "deleted_at IS NULL";

export interface Adopted {
  added: number;
  skipped: number;
  /** Account cards that received guest review logs; their FSRS state needs a refresh. */
  touched: string[];
}

const asDraft = (row: Values): CardDraft & { id: string; deckId: string } => ({
  id: String(row.id),
  deckId: String(row.deck_id),
  front: String(row.front ?? ""),
  meanings: [],
  usageLabel: (row.usage_label ?? undefined) as string | undefined,
  dictSenseId: (row.dict_sense_id ?? undefined) as string | undefined,
});

/**
 * Copies live guest decks, cards and logs into the account with their ids.
 * Same-name decks merge; a card already in the target deck (same dictionary
 * sense, or same front and usage label) is skipped and its logs move to it.
 * Guest settings fill only the fields the account has not set.
 */
export async function adoptGuest(guest: LocalStore, user: LocalStore): Promise<Adopted> {
  const userDecks = await user.select(Table.Decks, LIVE, []);
  const deckByName = new Map(userDecks.map((d) => [searchKey(String(d.name ?? "")), String(d.id)]));
  const userCards = (await user.select(Table.Cards, LIVE, [])).map(asDraft);

  const edits: Edit[] = [];
  const settings = await unsetSettings(guest, user);
  if (settings !== undefined) {
    edits.push({ table: Table.Settings, id: SETTINGS_ID, changes: settings });
  }

  const deckIds = new Map<string, string>();
  for (const deck of await guest.select(Table.Decks, LIVE, [])) {
    const existing = deckByName.get(searchKey(String(deck.name ?? "")));
    deckIds.set(String(deck.id), existing ?? String(deck.id));
    if (existing === undefined) {
      const { id, ...changes } = deck;
      edits.push({ table: Table.Decks, id: String(id), changes });
    }
  }

  const cardIds = new Map<string, string>();
  let skipped = 0;
  for (const card of await guest.select(Table.Cards, LIVE, [])) {
    const deckId = deckIds.get(String(card.deck_id));
    if (deckId === undefined) {
      continue; // its deck was deleted
    }
    const twin = findDuplicate(asDraft(card), userCards.filter((c) => c.deckId === deckId));
    if (twin !== undefined) {
      cardIds.set(String(card.id), twin.id);
      skipped++;
      continue;
    }

    cardIds.set(String(card.id), String(card.id));
    const changes: Values = { ...card, deck_id: deckId };
    delete changes.id;
    delete changes.fsrs_state; // device cache, rebuilt from logs by Study.refresh
    edits.push({ table: Table.Cards, id: String(card.id), changes });
  }
  await user.writeAll(edits);

  const touched = new Set<string>();
  const logs = [];
  for (const log of await guest.select(Table.ReviewLogs, "1 = 1", [])) {
    const cardId = cardIds.get(String(log.card_id));
    if (cardId === undefined) {
      continue;
    }
    touched.add(cardId);
    const { id, ...values } = log;
    logs.push({ id: String(id), log: { ...values, card_id: cardId } });
  }
  await user.appendAll(logs);

  return { added: cardIds.size - skipped, skipped, touched: [...touched] };
}

/** Guest settings for the fields the account has not set. */
async function unsetSettings(guest: LocalStore, user: LocalStore): Promise<Values | undefined> {
  const theirs = (await guest.read(Table.Settings, SETTINGS_ID)) ?? {};
  const mine = (await user.read(Table.Settings, SETTINGS_ID)) ?? {};
  const fill = Object.entries(theirs).filter(([k, v]) => k !== "id" && (v ?? null) !== null && (mine[k] ?? null) === null);
  return fill.length === 0 ? undefined : Object.fromEntries(fill);
}
