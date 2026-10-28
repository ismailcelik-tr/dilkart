import { beforeEach, describe, expect, it } from "vitest";

import { LocalStore } from "../sync/localStore";
import { testDriver } from "../sync/testDriver";
import { exportData } from "./export";
import { Library } from "./library";
import { DEFAULT_SETTINGS, Settings } from "./settings";

const NOW = Date.parse("2026-10-28T18:00:00Z");
let store: LocalStore;
let lib: Library;
let settings: Settings;

const id = (r: { ok: boolean; id?: string }) => r.id ?? "";

beforeEach(async () => {
  const db = testDriver();
  store = new LocalStore(db, "dev", () => NOW);
  await store.open();
  lib = new Library(store, db, () => NOW);
  settings = new Settings(store);
});

describe("exportData", () => {
  it("writes live decks with their cards, reviews of live cards and settings", async () => {
    const verbs = id(await lib.createDeck("Fiiller"));
    const gone = id(await lib.createDeck("Eski"));
    const go = id(await lib.createCard(verbs, { front: "go", meanings: [{ tr: "gitmek" }], exampleEn: "Let's go." }));
    const run = id(await lib.createCard(verbs, { front: "run", meanings: [{ tr: "koşmak" }] }));
    await lib.removeCard(run);
    await lib.removeDeck(gone);
    const log = { reviewed_at: "2026-10-28T08:00:00.000Z", rating: 3, mode: 1, tz_offset_min: 180, elapsed_ms: 1, scheduled: true };
    await store.append("l1", { ...log, card_id: go });
    await store.append("l2", { ...log, card_id: run });
    await settings.set({ newPerDay: 30 });

    expect(await exportData(store, lib, settings, NOW)).toEqual({
      app: "DilKart",
      version: 1,
      exportedAt: "2026-10-28T18:00:00.000Z",
      settings: { ...DEFAULT_SETTINGS, newPerDay: 30 },
      decks: [
        { id: verbs, name: "Fiiller", cards: [{ id: go, front: "go", meanings: [{ tr: "gitmek" }], exampleEn: "Let's go.", isWeak: false }] },
      ],
      reviews: [{ cardId: go, reviewedAt: "2026-10-28T08:00:00.000Z", rating: 3 }],
    });
  });
});
