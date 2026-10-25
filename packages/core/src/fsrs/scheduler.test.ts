import { createEmptyCard, fsrs, generatorParameters, type Grade } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { CardState, Rating, Scheduler, type Review } from "./scheduler";

const T0 = Date.parse("2026-10-25T06:00:00Z");
const MIN = 60_000;
const DAY = 86_400_000;

const at = (ms: number) => new Date(T0 + ms).toISOString();

// A realistic history: learning steps, graduation, a lapse, recovery.
const HISTORY: Review[] = [
  { id: "a", reviewedAt: at(0), rating: Rating.Good, scheduled: true },
  { id: "b", reviewedAt: at(10 * MIN), rating: Rating.Good, scheduled: true },
  { id: "c", reviewedAt: at(3 * DAY), rating: Rating.Good, scheduled: true },
  { id: "d", reviewedAt: at(12 * DAY), rating: Rating.Again, scheduled: true },
  { id: "e", reviewedAt: at(12 * DAY + 10 * MIN), rating: Rating.Good, scheduled: true },
  { id: "f", reviewedAt: at(14 * DAY), rating: Rating.Easy, scheduled: true },
];

describe("Scheduler", () => {
  const scheduler = new Scheduler();

  it("matches ts-fsrs step by step", () => {
    const f = fsrs(generatorParameters({ enable_fuzz: false }));
    let card = createEmptyCard(new Date(0));
    for (const r of HISTORY) {
      card = f.next(card, new Date(r.reviewedAt), r.rating as number as Grade).card;
    }

    const state = scheduler.replay(HISTORY);
    expect(state).toMatchObject({
      due: card.due.toISOString(),
      stability: card.stability,
      difficulty: card.difficulty,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state as number,
      lastReview: card.last_review?.toISOString(),
    });
  });

  it("pins FSRS-6 outputs so a library upgrade cannot shift schedules silently", () => {
    expect(scheduler.replay(HISTORY)).toMatchSnapshot();
  });

  it("replays to the same state whatever order logs arrive in", () => {
    const shuffled = [HISTORY[3], HISTORY[0], HISTORY[5], HISTORY[1], HISTORY[4], HISTORY[2]] as Review[];
    expect(scheduler.replay(shuffled)).toEqual(scheduler.replay(HISTORY));
  });

  it("orders equal timestamps by id", () => {
    const tie: Review[] = [
      { id: "y", reviewedAt: at(0), rating: Rating.Again, scheduled: true },
      { id: "x", reviewedAt: at(0), rating: Rating.Easy, scheduled: true },
    ];
    expect(scheduler.replay(tie)).toEqual(scheduler.replay([...tie].reverse()));
  });

  it("equals rating one review at a time", () => {
    let state = undefined;
    for (const r of HISTORY) {
      state = scheduler.rate(state, r.rating, r.reviewedAt);
    }
    expect(state).toEqual(scheduler.replay(HISTORY));
  });

  it("skips practice reviews", () => {
    const practice: Review = { id: "p", reviewedAt: at(13 * DAY), rating: Rating.Again, scheduled: false };
    expect(scheduler.replay([...HISTORY, practice])).toEqual(scheduler.replay(HISTORY));
  });

  it("leaves a card without scheduled reviews new", () => {
    expect(scheduler.replay([])).toBeUndefined();
    expect(scheduler.rate(undefined, Rating.Good, at(0)).state).toBe(CardState.Learning);
  });

  it("schedules sooner for a higher desired retention", () => {
    const due = (s: Scheduler) => Date.parse(s.replay(HISTORY.slice(0, 3))?.due ?? "");
    expect(due(new Scheduler(0.95))).toBeLessThan(due(new Scheduler(0.9)));
  });
});
