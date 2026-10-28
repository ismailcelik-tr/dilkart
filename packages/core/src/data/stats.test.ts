import { beforeEach, describe, expect, it } from "vitest";

import { dayKey } from "../fsrs/day";
import { CardState, Rating, type FsrsState } from "../fsrs/scheduler";
import { uuidv7 } from "../sync/id";
import { LocalStore } from "../sync/localStore";
import { testDriver } from "../sync/testDriver";
import { Library } from "./library";
import { GOAL_OFF, Settings } from "./settings";
import { Stats } from "./stats";

const NOW = Date.parse("2026-10-27T09:00:00Z"); // 12:00 Istanbul
const TZ = 180;
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

let store: LocalStore;
let lib: Library;
let settings: Settings;
let stats: Stats;
let deck: string;

beforeEach(async () => {
  const db = testDriver();
  store = new LocalStore(db, "dev", () => NOW);
  await store.open();
  lib = new Library(store, db, () => NOW);
  settings = new Settings(store);
  stats = new Stats(store, lib, settings, () => NOW, () => TZ);
  const created = await lib.createDeck("Fiiller");
  deck = created.ok ? created.id : "";
});

async function card(front: string) {
  const r = await lib.createCard(deck, { front, meanings: [{ tr: `${front}-tr` }] });
  return r.ok ? r.id : "";
}

async function answer(cardId: string, msAgo: number, rating = Rating.Good, scheduled = true) {
  const at = NOW - msAgo;
  await store.append(uuidv7(at), {
    card_id: cardId,
    reviewed_at: new Date(at).toISOString(),
    rating,
    mode: 1,
    tz_offset_min: TZ,
    elapsed_ms: 1_000,
    scheduled,
  });
}

const mature = (due: number): FsrsState => ({
  due: new Date(due).toISOString(),
  stability: 30,
  difficulty: 5,
  scheduledDays: 30,
  learningSteps: 0,
  reps: 3,
  lapses: 0,
  state: CardState.Review,
  lastReview: null,
});

describe("Stats.today", () => {
  it("is empty with the default goal before any study", async () => {
    expect(await stats.today()).toEqual({ streak: 0, answers: 0, goal: 50 });
  });

  it("counts today's answers, practice included", async () => {
    const go = await card("go");
    await answer(go, HOUR);
    await answer(go, 2 * HOUR, Rating.Again, false);
    await answer(go, DAY);
    expect(await stats.today()).toEqual({ streak: 2, answers: 2, goal: 50 });
  });

  it("keeps yesterday's streak until today ends and breaks after a missed day", async () => {
    const go = await card("go");
    await answer(go, DAY);
    await answer(go, 2 * DAY);
    expect((await stats.today()).streak).toBe(2);

    await settings.set({ dailyGoal: GOAL_OFF });
    const fresh = new Stats(store, lib, settings, () => NOW + DAY, () => TZ);
    expect(await fresh.today()).toEqual({ streak: 0, answers: 0, goal: GOAL_OFF });
  });
});

describe("Stats.report", () => {
  it("has an empty history before any study", async () => {
    await card("go");
    const r = await stats.report();
    expect(r.today).toBe(dayKey(new Date(NOW), 4, TZ));
    expect(r.streak).toEqual({ current: 0, longest: 0 });
    expect(r.daily).toEqual(new Array(30).fill(0));
    expect(r.retention7).toBeNull();
    expect(r.retention30).toBeNull();
    expect(r.states).toEqual({ new: 1, learning: 0, review: 0, mature: 0 });
    expect(r.forecast).toEqual(new Array(7).fill(0));
  });

  it("summarizes answers and card states", async () => {
    const go = await card("go");
    await card("run");
    await answer(go, 20 * DAY);
    await answer(go, 20 * DAY - 10 * MIN);
    await answer(go, 3 * DAY);
    await store.cacheFsrs(go, mature(NOW + DAY));

    const r = await stats.report();
    expect(r.daily[29 - 20]).toBe(2);
    expect(r.daily[29 - 3]).toBe(1);
    expect(r.daily.reduce((a, b) => a + b)).toBe(3);
    expect(r.streak).toEqual({ current: 0, longest: 1 });
    expect(r.retention7).toEqual({ rate: 1, total: 1 });
    expect(r.retention30).toEqual({ rate: 1, total: 1 });
    expect(r.states).toEqual({ new: 1, learning: 0, review: 0, mature: 1 });
    expect(r.forecast[1]).toBe(1);
    expect(r.goal).toBe(50);
  });

  it("agrees with today on the streak", async () => {
    const go = await card("go");
    for (const d of [0, 1, 2, 5]) {
      await answer(go, d * DAY + HOUR);
    }
    expect((await stats.report()).streak.current).toBe((await stats.today()).streak);
  });
});

describe("Stats.reminders", () => {
  it("skips today after study and counts due cards", async () => {
    const go = await card("go");
    await answer(go, HOUR);
    await store.cacheFsrs(go, mature(NOW + DAY));

    const plan = await stats.reminders(20 * 60);
    expect(plan).toHaveLength(6);
    expect(plan[0]).toEqual({
      at: new Date("2026-10-28T17:00:00Z"),
      title: "🔥 1 günlük serin bitmesin",
      body: "Bugün 1 kart seni bekliyor",
    });
  });
});
