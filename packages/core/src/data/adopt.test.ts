import { beforeEach, describe, expect, it } from "vitest";

import { LocalStore, Table } from "../sync/localStore";
import { testDriver } from "../sync/testDriver";
import { adoptGuest } from "./adopt";
import { Library } from "./library";
import { Accent, Settings } from "./settings";

async function side() {
  const db = testDriver();
  const store = new LocalStore(db);
  await store.open();
  return { store, lib: new Library(store, db) };
}

let guest: Awaited<ReturnType<typeof side>>;
let user: Awaited<ReturnType<typeof side>>;

beforeEach(async () => {
  guest = await side();
  user = await side();
});

const ok = (r: { ok: boolean; id?: string }) => {
  if (!r.ok || r.id === undefined) {
    throw new Error("expected ok");
  }
  return r.id;
};

const draft = (front: string, extra: object = {}) => ({ front, meanings: [{ tr: `${front}-tr` }], ...extra });

async function log(store: LocalStore, cardId: string, id: string) {
  await store.append(id, { card_id: cardId, reviewed_at: "2026-10-25T06:00:00Z", rating: 3, mode: 1, tz_offset_min: 180, elapsed_ms: 1, scheduled: true });
}

describe("adoptGuest", () => {
  it("moves guest settings into an account that has none", async () => {
    await new Settings(guest.store).set({ newPerDay: 30, dayStartHour: 0 });
    await adoptGuest(guest.store, user.store);
    expect(await new Settings(user.store).get()).toMatchObject({ newPerDay: 30, dayStartHour: 0 });
  });

  it("keeps the account's own settings and fills only the unset ones", async () => {
    await new Settings(guest.store).set({ newPerDay: 30, accent: Accent.GB });
    await new Settings(user.store).set({ newPerDay: 10 });
    await adoptGuest(guest.store, user.store);
    expect(await new Settings(user.store).get()).toMatchObject({ newPerDay: 10, accent: Accent.GB });
  });

  it("copies everything into an empty account with the same ids", async () => {
    const deck = ok(await guest.lib.createDeck("Fiiller"));
    const card = ok(await guest.lib.createCard(deck, draft("go", { exampleEn: "Go!" })));
    await log(guest.store, card, "0199c1d2-0000-7000-8000-0000000000e1");

    const result = await adoptGuest(guest.store, user.store);

    expect(result).toEqual({ added: 1, skipped: 0, touched: [card] });
    expect(await user.lib.decks()).toEqual([{ id: deck, name: "Fiiller", cardCount: 1 }]);
    expect(await user.lib.card(card)).toMatchObject({ front: "go", exampleEn: "Go!", deckId: deck });
    expect(await user.store.select(Table.ReviewLogs, "card_id = ?", [card])).toHaveLength(1);
    expect((await user.store.pending(100)).length).toBeGreaterThan(0);
  });

  it("merges same-name decks and skips duplicate cards, keeping their history", async () => {
    const userDeck = ok(await user.lib.createDeck("Fiiller"));
    const userGo = ok(await user.lib.createCard(userDeck, draft("go")));
    const userSense = ok(await user.lib.createCard(userDeck, draft("run", { dictSenseId: "42" })));
    ok(await user.lib.createCard(userDeck, draft("bank", { usageLabel: "finans" })));

    const guestDeck = ok(await guest.lib.createDeck(" fiiller "));
    const guestGo = ok(await guest.lib.createCard(guestDeck, draft("Go!")));
    ok(await guest.lib.createCard(guestDeck, draft("running", { dictSenseId: "42" })));
    const guestBank = ok(await guest.lib.createCard(guestDeck, draft("bank", { usageLabel: "nehir" })));
    const otherDeck = ok(await guest.lib.createDeck("Yeni"));
    const see = ok(await guest.lib.createCard(otherDeck, draft("see")));
    await log(guest.store, guestGo, "0199c1d2-0000-7000-8000-0000000000e2");

    const result = await adoptGuest(guest.store, user.store);

    expect(result.added).toBe(2);
    expect(result.skipped).toBe(2);
    expect((await user.lib.decks()).map((d) => [d.name, d.cardCount])).toEqual([
      ["Fiiller", 4],
      ["Yeni", 1],
    ]);
    const ids = (await user.lib.cards(userDeck)).map((c) => c.id);
    expect(ids).toHaveLength(4);
    expect(ids).toEqual(expect.arrayContaining([userGo, userSense, guestBank]));
    expect(await user.lib.card(see)).toMatchObject({ deckId: otherDeck });
    expect(await user.store.select(Table.ReviewLogs, "card_id = ?", [userGo])).toHaveLength(1);
    expect(result.touched).toEqual([userGo]);
  });

  it("leaves deleted guest decks and cards behind", async () => {
    const deck = ok(await guest.lib.createDeck("Eski"));
    await guest.lib.createCard(deck, draft("go"));
    await guest.lib.removeDeck(deck);
    const kept = ok(await guest.lib.createDeck("Kalan"));
    const gone = ok(await guest.lib.createCard(kept, draft("run")));
    await guest.lib.removeCard(gone);

    expect(await adoptGuest(guest.store, user.store)).toEqual({ added: 0, skipped: 0, touched: [] });
    expect((await user.lib.decks()).map((d) => d.name)).toEqual(["Kalan"]);
  });
});
