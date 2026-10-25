// Decks and cards on the device. Writes go through LocalStore so every change
// reaches the outbox (ADR 0009).
import { validate, type CardDraft, type CardError } from "../card/card";
import type { SqlReader } from "../dictionary/lookup";
import type { FsrsState } from "../fsrs/scheduler";
import { uuidv7 } from "../sync/id";
import { Table, type Edit, type LocalStore } from "../sync/localStore";
import type { Values } from "../sync/merge";

export enum DeckError {
  EmptyName = "empty_name",
}

export interface Deck {
  id: string;
  name: string;
  cardCount: number;
}

export interface Card extends CardDraft {
  id: string;
  deckId: string;
  isWeak: boolean;
  /** Undefined while the card is new. */
  fsrs?: FsrsState;
}

export type Saved<E> = { ok: true; id: string } | { ok: false; errors: E[] };

const LOCALE = "tr";
const LIVE = "deleted_at IS NULL";

const byText = (a: string, b: string) => a.localeCompare(b, LOCALE);

/** CardDraft fields as card columns; undefined means "not set". */
function toRow(c: CardDraft): Values {
  return {
    front: c.front,
    meanings: c.meanings,
    usage_label: c.usageLabel ?? null,
    example_en: c.exampleEn ?? null,
    example_tr: c.exampleTr ?? null,
    dict_entry_id: c.dictEntryId ?? null,
    dict_sense_id: c.dictSenseId ?? null,
  };
}

const optional = (v: unknown) => (v == null ? undefined : String(v));

function toCard(v: Values): Card {
  return {
    id: String(v.id),
    deckId: String(v.deck_id),
    front: String(v.front ?? ""),
    meanings: (v.meanings ?? []) as Card["meanings"],
    usageLabel: optional(v.usage_label),
    exampleEn: optional(v.example_en),
    exampleTr: optional(v.example_tr),
    dictEntryId: optional(v.dict_entry_id),
    dictSenseId: optional(v.dict_sense_id),
    isWeak: v.is_weak === true,
    fsrs: (v.fsrs_state ?? undefined) as FsrsState | undefined,
  };
}

export class Library {
  constructor(
    private readonly store: LocalStore,
    private readonly reader: SqlReader,
    private readonly now: () => number = Date.now,
  ) {}

  async decks(): Promise<Deck[]> {
    const decks = await this.store.select(Table.Decks, LIVE, []);
    const counts = await this.reader.all<{ deck_id: string; n: number }>(
      `SELECT deck_id, count(*) AS n FROM ${Table.Cards} WHERE ${LIVE} GROUP BY deck_id`,
      [],
    );
    const byDeck = new Map(counts.map((c) => [c.deck_id, c.n]));

    return decks
      .map((d) => ({ id: String(d.id), name: String(d.name ?? ""), cardCount: byDeck.get(String(d.id)) ?? 0 }))
      .sort((a, b) => byText(a.name, b.name));
  }

  async createDeck(name: string): Promise<Saved<DeckError>> {
    const clean = name.trim();
    if (clean === "") {
      return { ok: false, errors: [DeckError.EmptyName] };
    }

    const id = uuidv7(this.now());
    await this.store.write(Table.Decks, id, { name: clean });
    return { ok: true, id };
  }

  async renameDeck(id: string, name: string): Promise<Saved<DeckError>> {
    const clean = name.trim();
    if (clean === "") {
      return { ok: false, errors: [DeckError.EmptyName] };
    }

    await this.store.write(Table.Decks, id, { name: clean });
    return { ok: true, id };
  }

  /** Tombstones the deck and its cards in one step. */
  async removeDeck(id: string): Promise<void> {
    const deletedAt = this.timestamp();
    const cards = await this.store.select(Table.Cards, `deck_id = ? AND ${LIVE}`, [id]);
    const edits: Edit[] = [
      { table: Table.Decks, id, changes: { deleted_at: deletedAt } },
      ...cards.map((c) => ({ table: Table.Cards, id: String(c.id), changes: { deleted_at: deletedAt } }) as Edit),
    ];
    await this.store.writeAll(edits);
  }

  async cards(deckId: string): Promise<Card[]> {
    const rows = await this.store.select(Table.Cards, `deck_id = ? AND ${LIVE}`, [deckId]);
    return rows.map(toCard).sort((a, b) => byText(a.front, b.front));
  }

  async allCards(): Promise<Card[]> {
    const rows = await this.store.select(Table.Cards, LIVE, []);
    return rows.map(toCard).sort((a, b) => byText(a.front, b.front));
  }

  async card(id: string): Promise<Card | undefined> {
    const [row] = await this.store.select(Table.Cards, `id = ? AND ${LIVE}`, [id]);
    return row && toCard(row);
  }

  async createCard(deckId: string, draft: CardDraft): Promise<Saved<CardError>> {
    const result = validate(draft);
    if (!result.ok) {
      return result;
    }

    const id = uuidv7(this.now());
    await this.store.write(Table.Cards, id, { ...toRow(result.card), deck_id: deckId, is_weak: false });
    return { ok: true, id };
  }

  /** Writes only changed fields, so a concurrent edit of another field survives sync. */
  async updateCard(id: string, draft: CardDraft): Promise<Saved<CardError>> {
    const result = validate(draft);
    if (!result.ok) {
      return result;
    }
    const current = await this.card(id);
    if (current === undefined) {
      throw new Error(`card ${id} not found`);
    }

    const before = toRow(current);
    const after = toRow(result.card);
    const changes = Object.fromEntries(
      Object.entries(after).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k])),
    );
    if (Object.keys(changes).length > 0) {
      await this.store.write(Table.Cards, id, changes);
    }
    return { ok: true, id };
  }

  async moveCard(id: string, deckId: string): Promise<void> {
    await this.store.write(Table.Cards, id, { deck_id: deckId });
  }

  async removeCard(id: string): Promise<void> {
    await this.store.write(Table.Cards, id, { deleted_at: this.timestamp() });
  }

  private timestamp(): string {
    return new Date(this.now()).toISOString();
  }
}
