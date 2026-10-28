// Data export (KVKK portability); docs/superpowers/specs/2026-10-28-account-delete-export-design.md.
import type { Meaning } from "../card/card";
import type { LocalStore } from "../sync/localStore";
import type { Library } from "./library";
import { reviewsByCard } from "./reviews";
import type { Settings, UserSettings } from "./settings";

const FORMAT_VERSION = 1;

export interface ExportCard {
  id: string;
  front: string;
  meanings: Meaning[];
  usageLabel?: string;
  exampleEn?: string;
  exampleTr?: string;
  isWeak: boolean;
}

export interface Export {
  app: "DilKart";
  version: typeof FORMAT_VERSION;
  exportedAt: string;
  settings: UserSettings;
  decks: { id: string; name: string; cards: ExportCard[] }[];
  reviews: { cardId: string; reviewedAt: string; rating: number }[];
}

/** Live decks, cards and their review logs; scheduling state is left out, the logs rebuild it. */
export async function exportData(store: LocalStore, lib: Library, settings: Settings, now: number): Promise<Export> {
  const cards = await lib.allCards();
  const logs = await reviewsByCard(store);
  return {
    app: "DilKart",
    version: FORMAT_VERSION,
    exportedAt: new Date(now).toISOString(),
    settings: await settings.get(),
    decks: (await lib.decks()).map((d) => ({
      id: d.id,
      name: d.name,
      cards: cards
        .filter((c) => c.deckId === d.id)
        .map(({ id, front, meanings, usageLabel, exampleEn, exampleTr, isWeak }) => ({ id, front, meanings, usageLabel, exampleEn, exampleTr, isWeak })),
    })),
    reviews: cards.flatMap((c) => (logs.get(c.id) ?? []).map((r) => ({ cardId: c.id, reviewedAt: r.reviewedAt, rating: r.rating }))),
  };
}
