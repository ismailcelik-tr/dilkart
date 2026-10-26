import { beforeEach, describe, expect, it } from "vitest";

import { Rating } from "../fsrs/scheduler";
import { uuidv7 } from "../sync/id";
import { LocalStore, Table } from "../sync/localStore";
import { testDriver } from "../sync/testDriver";
import { Library } from "./library";
import { WeakWords } from "./weakWords";

const MIN = 60_000;
const DAY = 86_400_000;

let now: number;
let store: LocalStore;
let lib: Library;
let weak: WeakWords;
let deck: string;

beforeEach(async () => {
  now = Date.parse("2026-10-26T09:00:00Z");
  const db = testDriver();
  store = new LocalStore(db, "dev", () => now);
  await store.open();
  lib = new Library(store, db, () => now);
  weak = new WeakWords(store, lib, () => now);
  const created = await lib.createDeck("Fiiller");
  deck = created.ok ? created.id : "";
});

async function card(front: string) {
  const r = await lib.createCard(deck, { front, meanings: [{ tr: `${front}-tr` }] });
  return r.ok ? r.id : "";
}

async function answers(cardId: string, ratings: Rating[]) {
  for (const rating of ratings) {
    now += MIN;
    await store.append(uuidv7(now), {
      card_id: cardId,
      reviewed_at: new Date(now).toISOString(),
      rating,
      mode: 1,
      tz_offset_min: 180,
      elapsed_ms: 1_000,
      scheduled: true,
    });
  }
}

const AGAIN3 = [Rating.Again, Rating.Again, Rating.Again];
const fronts = (cards: { front: string }[]) => cards.map((c) => c.front);

describe("WeakWords", () => {
  it("suggests only cards that meet the rule", async () => {
    await answers(await card("go"), AGAIN3);
    await answers(await card("run"), [Rating.Again, Rating.Good]);
    await card("see");
    expect(fronts(await weak.suggestions())).toEqual(["go"]);
  });

  it("skips weak cards and rejected ones until the 14 days pass", async () => {
    const go = await card("go");
    const run = await card("run");
    await answers(go, AGAIN3);
    await answers(run, AGAIN3);
    now += MIN;
    await weak.decide([go], [run]);
    expect(await weak.suggestions()).toEqual([]);

    now += 15 * DAY;
    expect(fronts(await weak.suggestions())).toEqual(["run"]);
  });

  it("marks accepted cards weak and hides rejected ones for 14 days", async () => {
    const go = await card("go");
    const run = await card("run");
    await weak.decide([go], [run]);

    expect(await store.read(Table.Cards, go)).toMatchObject({ is_weak: true, weak_since: new Date(now).toISOString() });
    expect((await store.read(Table.Cards, run))?.weak_dismissed_until).toBe(new Date(now + 14 * DAY).toISOString());
    expect(fronts(await weak.cards())).toEqual(["go"]);
  });

  it("clears the mark after three correct answers since it", async () => {
    const go = await card("go");
    await answers(go, AGAIN3);
    now += MIN;
    await weak.decide([go], []);

    await answers(go, [Rating.Good, Rating.Hard]);
    await weak.review(go);
    expect((await lib.card(go))?.isWeak).toBe(true);

    await answers(go, [Rating.Good]);
    await weak.review(go);
    expect(await store.read(Table.Cards, go)).toMatchObject({ is_weak: false, weak_since: null });
  });

  it("does not count correct answers from before the mark", async () => {
    const go = await card("go");
    await answers(go, [Rating.Good, Rating.Good, Rating.Good]);
    now += MIN;
    await weak.decide([go], []);

    await answers(go, [Rating.Good]);
    await weak.review(go);
    expect((await lib.card(go))?.isWeak).toBe(true);
  });
});
