import { beforeEach, describe, expect, it } from "vitest";

import { Library } from "../data/library";
import { Settings, type UserSettings } from "../data/settings";
import { Module, SessionKind } from "../fsrs/policy";
import { CardState, Rating } from "../fsrs/scheduler";
import { LocalStore, Table } from "../sync/localStore";
import { testDriver } from "../sync/testDriver";
import { Session } from "./session";
import { Study } from "./study";

const ISTANBUL = 180;
const T0 = Date.parse("2026-10-25T07:00:00Z"); // 10:00 local
const MIN = 60_000;
const DAY = 86_400_000;
const REVIEW = { session: SessionKind.Review, module: Module.Recall };

let now: number;
let lib: Library;
let store: LocalStore;
let deck: string;

async function setup(settings: Partial<UserSettings> = {}) {
  now = T0;
  const db = testDriver();
  store = new LocalStore(db, "dev", () => now);
  await store.open();
  if (Object.keys(settings).length > 0) {
    await new Settings(store).set(settings);
  }
  lib = new Library(store, db, () => now);
  const created = await lib.createDeck("Fiiller");
  deck = created.ok ? created.id : "";
  return new Study(store, lib, db, new Settings(store), () => now, () => ISTANBUL);
}

async function cards(n: number, prefix = "w") {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    now += 1; // distinct UUIDv7 times keep creation order
    const r = await lib.createCard(deck, { front: `${prefix}${i}`, meanings: [{ tr: `k${i}` }] });
    ids.push(r.ok ? r.id : "");
  }
  return ids;
}

/** Learns a card days ago so it becomes a review card due around now. */
async function learnedDaysAgo(study: Study, id: string, days: number) {
  const back = now;
  now = T0 - days * DAY;
  let card = await lib.card(id);
  for (const rating of [Rating.Good, Rating.Good]) {
    card = card && (await study.answer(card, rating, REVIEW, 1_000));
    now += 10 * MIN;
  }
  now = back;
  return card;
}

let study: Study;

async function cardOf(id: string) {
  const c = await lib.card(id);
  if (c === undefined) {
    throw new Error(`card ${id} missing`);
  }
  return c;
}

beforeEach(async () => {
  study = await setup();
});

describe("Study.plan", () => {
  it("takes new cards in creation order up to the daily limit", async () => {
    study = await setup({ newPerDay: 3 });
    const ids = await cards(5);
    const plan = await study.plan(deck);
    expect(plan.cards.map((c) => c.id)).toEqual(ids.slice(0, 3));
    expect(plan.counts).toEqual({ learning: 0, review: 0, new: 3 });
  });

  it("puts one new card after every five reviews, most overdue first", async () => {
    const reviews = await cards(7, "r");
    for (const [i, id] of reviews.entries()) {
      await learnedDaysAgo(study, id, 30 - i);
    }
    await cards(2, "n");

    const plan = await study.plan(deck);
    const order = plan.cards.map((c) => c.front);
    expect(order).toEqual(["r0", "r1", "r2", "r3", "r4", "n0", "r5", "r6", "n1"]);
    expect(plan.counts).toEqual({ learning: 0, review: 7, new: 2 });
  });

  it("applies a changed limit without a new Study", async () => {
    study = await setup({ newPerDay: 3 });
    await cards(5);
    await new Settings(store).set({ newPerDay: 1 });
    expect((await study.plan(deck)).counts.new).toBe(1);
  });

  it("leaves out cards not yet due", async () => {
    const [id = ""] = await cards(1);
    await learnedDaysAgo(study, id, 0);
    expect((await study.plan(deck)).cards).toEqual([]);
  });

  it("subtracts what was already done today", async () => {
    study = await setup({ newPerDay: 3 });
    const ids = await cards(5);
    await study.answer(await cardOf(ids[0] ?? ""), Rating.Good, REVIEW, 1_000);
    now += 30 * MIN;
    const plan = await study.plan(deck);
    expect(plan.counts.new).toBe(2);
  });

  it("limits reviews per day", async () => {
    study = await setup({ reviewsPerDay: 2 });
    for (const id of await cards(4)) {
      await learnedDaysAgo(study, id, 20);
    }
    expect((await study.plan(deck)).counts.review).toBe(2);
  });
});

describe("Study.answer", () => {
  it("logs the answer and updates the cached state", async () => {
    const [id = ""] = await cards(1);
    const card = await study.answer(await cardOf(id), Rating.Good, REVIEW, 1_500);
    expect(card.fsrs?.state).toBe(CardState.Learning);
    expect((await lib.card(id))?.fsrs).toEqual(card.fsrs);

    const [log] = await store.select(Table.ReviewLogs, "card_id = ?", [id]);
    expect(log).toMatchObject({ rating: Rating.Good, mode: Module.Recall, tz_offset_min: ISTANBUL, elapsed_ms: 1_500, scheduled: true });
  });

  it("logs practice without touching the schedule", async () => {
    const [id = ""] = await cards(1);
    const card = await study.answer(await cardOf(id), Rating.Again, { session: SessionKind.Free, module: Module.Typing }, 900);
    expect(card.fsrs).toBeUndefined();
    const [log] = await store.select(Table.ReviewLogs, "card_id = ?", [id]);
    expect(log).toMatchObject({ scheduled: false, mode: Module.Typing });
  });

  it("previews the next interval of each rating", async () => {
    const [id = ""] = await cards(1);
    const ms = study.intervals((await learnedDaysAgo(study, id, 5)) ?? (await cardOf(id)));
    expect(ms[Rating.Again]).toBeLessThan(ms[Rating.Hard]);
    expect(ms[Rating.Hard]).toBeLessThan(ms[Rating.Good]);
    expect(ms[Rating.Good]).toBeLessThan(ms[Rating.Easy]);
  });
});

describe("Study.refresh", () => {
  it("replays a card's logs into its cache", async () => {
    const [id = ""] = await cards(1);
    const learned = await learnedDaysAgo(study, id, 3);
    await store.cacheFsrs(id, null);
    await study.refresh([id]);
    expect((await lib.card(id))?.fsrs).toEqual(learned?.fsrs);
  });
});

describe("Session", () => {
  it("brings a learning card back once its step is due", async () => {
    const [a = "", b = ""] = await cards(2);
    const session = new Session((await study.plan(deck)).cards, study, REVIEW, () => now);

    expect(session.current()?.id).toBe(a);
    await session.answer(Rating.Good, 1_000); // a → 10 min step
    expect(session.current()?.id).toBe(b);
    await session.answer(Rating.Again, 1_000); // b → 1 min step

    // Queue empty: steps within 20 minutes are shown early, soonest first.
    expect(session.current()?.id).toBe(b);
    await session.answer(Rating.Good, 1_000);
    expect(session.current()?.id).toBe(a);
    now += 10 * MIN;
    await session.answer(Rating.Good, 1_000); // a graduates
    expect(session.current()?.id).toBe(b);
    await session.answer(Rating.Good, 1_000); // b graduates
    expect(session.current()).toBeUndefined();
    expect(session.progress()).toEqual({ done: 5, left: 0 });
  });

  it("shows each card once in a practice session", async () => {
    await cards(3);
    const free = { session: SessionKind.Free, module: Module.Recall };
    const session = new Session(await lib.cards(deck), study, free, () => now);
    for (let i = 0; i < 3; i++) {
      await session.answer(Rating.Again, 1_000);
    }
    expect(session.current()).toBeUndefined();
  });
});
