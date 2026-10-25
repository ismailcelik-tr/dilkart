import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { CardError } from "../card/card";
import { LocalStore, Table } from "../sync/localStore";
import { testDriver } from "../sync/testDriver";
import { DeckError, Library } from "./library";

const NOW = Date.parse("2026-10-25T06:00:00Z");

async function open(path?: string) {
  const db = testDriver(path);
  const store = new LocalStore(db, "dev", () => NOW);
  await store.open();
  return { db, store, lib: new Library(store, db, () => NOW) };
}

let ctx: Awaited<ReturnType<typeof open>>;

beforeEach(async () => {
  ctx = await open();
});

const ok = <T>(r: { ok: true; id: T } | { ok: false }) => {
  if (!r.ok) {
    throw new Error("expected ok");
  }
  return r.id;
};

const draft = (front: string, tr = "anlam") => ({ front, meanings: [{ tr }] });

describe("decks", () => {
  it("lists decks in Turkish order with live card counts", async () => {
    const c = ok(await ctx.lib.createDeck("Çiçekler"));
    const b = ok(await ctx.lib.createDeck("Cümleler"));
    ok(await ctx.lib.createDeck("Dersler"));
    await ctx.lib.createCard(c, draft("rose"));
    const gone = ok(await ctx.lib.createCard(c, draft("tulip")));
    await ctx.lib.removeCard(gone);

    const decks = await ctx.lib.decks();
    expect(decks.map((d) => d.name)).toEqual(["Cümleler", "Çiçekler", "Dersler"]);
    expect(decks.find((d) => d.id === c)?.cardCount).toBe(1);
    expect(decks.find((d) => d.id === b)?.cardCount).toBe(0);
  });

  it("rejects an empty name", async () => {
    expect(await ctx.lib.createDeck("  ")).toEqual({ ok: false, errors: [DeckError.EmptyName] });
  });

  it("renames", async () => {
    const id = ok(await ctx.lib.createDeck("Eski"));
    await ctx.lib.renameDeck(id, " Yeni ");
    expect((await ctx.lib.decks())[0]?.name).toBe("Yeni");
  });

  it("removes a deck together with its cards", async () => {
    const keep = ok(await ctx.lib.createDeck("Kalan"));
    const drop = ok(await ctx.lib.createDeck("Giden"));
    await ctx.lib.createCard(keep, draft("stay"));
    const card = ok(await ctx.lib.createCard(drop, draft("go")));

    await ctx.lib.removeDeck(drop);
    expect((await ctx.lib.decks()).map((d) => d.id)).toEqual([keep]);
    expect(await ctx.lib.card(card)).toBeUndefined();
    expect((await ctx.store.read(Table.Cards, card))?.deleted_at).toBe(new Date(NOW).toISOString());
  });
});

describe("cards", () => {
  let deck: string;

  beforeEach(async () => {
    deck = ok(await ctx.lib.createDeck("Fiiller"));
  });

  it("creates a validated card", async () => {
    const id = ok(await ctx.lib.createCard(deck, { front: " give up ", meanings: [{ tr: "vazgeçmek", pos: "verb" }, { tr: "" }], usageLabel: "" }));
    expect(await ctx.lib.card(id)).toEqual({
      id,
      deckId: deck,
      front: "give up",
      meanings: [{ tr: "vazgeçmek", pos: "verb" }],
      usageLabel: undefined,
      exampleEn: undefined,
      exampleTr: undefined,
      dictEntryId: undefined,
      dictSenseId: undefined,
      isWeak: false,
    });
    expect(await ctx.lib.createCard(deck, { front: "", meanings: [] })).toEqual({
      ok: false,
      errors: [CardError.EmptyFront, CardError.NoMeaning],
    });
  });

  it("writes only the fields an edit changes", async () => {
    const id = ok(await ctx.lib.createCard(deck, { ...draft("go", "gitmek"), exampleEn: "Go home." }));
    const before = (await ctx.store.pending(100)).length;

    await ctx.lib.updateCard(id, { ...draft("go", "gitmek"), exampleEn: "Go now." });
    const ops = (await ctx.store.pending(100)).slice(before).map((p) => p.op);
    expect(ops).toHaveLength(1);
    expect(ops[0]?.values).toEqual({ example_en: "Go now." });
    expect((await ctx.lib.card(id))?.exampleEn).toBe("Go now.");
  });

  it("skips an edit that changes nothing", async () => {
    const id = ok(await ctx.lib.createCard(deck, draft("go")));
    const before = (await ctx.store.pending(100)).length;
    expect(await ctx.lib.updateCard(id, draft("go"))).toEqual({ ok: true, id });
    expect(await ctx.store.pending(100)).toHaveLength(before);
  });

  it("moves to another deck", async () => {
    const other = ok(await ctx.lib.createDeck("Diğer"));
    const id = ok(await ctx.lib.createCard(deck, draft("go")));
    await ctx.lib.moveCard(id, other);
    expect((await ctx.lib.cards(deck)).map((c) => c.id)).toEqual([]);
    expect((await ctx.lib.cards(other)).map((c) => c.id)).toEqual([id]);
  });

  it("lists live cards of one deck in Turkish order", async () => {
    for (const f of ["şeker", "sabun", "zil", "çay"]) {
      await ctx.lib.createCard(deck, draft(f));
    }
    const removed = ok(await ctx.lib.createCard(deck, draft("ağaç")));
    await ctx.lib.removeCard(removed);
    expect((await ctx.lib.cards(deck)).map((c) => c.front)).toEqual(["çay", "sabun", "şeker", "zil"]);
  });

  it("lists 1,000 cards quickly", async () => {
    for (let i = 0; i < 1_000; i++) {
      await ctx.lib.createCard(deck, draft(`word${i}`, `kelime${i}`));
    }
    const started = performance.now();
    const cards = await ctx.lib.cards(deck);
    expect(cards).toHaveLength(1_000);
    expect(performance.now() - started).toBeLessThan(300);
  });
});

describe("persistence", () => {
  it("keeps every change after the app restarts", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "dilkart-")), "guest.sqlite");
    const first = await open(path);
    const a = ok(await first.lib.createDeck("A"));
    const b = ok(await first.lib.createDeck("B"));
    const moved = ok(await first.lib.createCard(a, draft("go")));
    const edited = ok(await first.lib.createCard(a, draft("run")));
    const removed = ok(await first.lib.createCard(a, draft("see")));
    await first.lib.moveCard(moved, b);
    await first.lib.updateCard(edited, draft("run", "koşmak"));
    await first.lib.removeCard(removed);
    const snapshot = { decks: await first.lib.decks(), a: await first.lib.cards(a), b: await first.lib.cards(b) };
    first.db.close();

    const second = await open(path);
    expect({ decks: await second.lib.decks(), a: await second.lib.cards(a), b: await second.lib.cards(b) }).toEqual(snapshot);
  });
});
