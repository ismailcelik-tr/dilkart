import { describe, expect, it } from "vitest";

import { dayKey } from "../fsrs/day";
import { CardState, Rating, type FsrsState, type Review } from "../fsrs/scheduler";
import { dailyCounts, forecast, retention, stateCounts, streak, streakOfDays, weekday, type DayContext } from "./stats";

const ISTANBUL: DayContext = { dayStartHour: 4, tzOffsetMin: 180 };
const NOW = "2026-10-25T09:00:00Z"; // 12:00 local
const MIN = 60_000;
const DAY = 86_400_000;

let seq = 0;
const at = (msAgo: number) => new Date(Date.parse(NOW) - msAgo).toISOString();
const review = (msAgo: number, rating = Rating.Good, scheduled = true): Review => ({
  id: String(seq++).padStart(4, "0"),
  reviewedAt: at(msAgo),
  rating,
  scheduled,
});
const graduated = (daysAgo: number) => [review(daysAgo * DAY), review(daysAgo * DAY - 10 * MIN)];

const state = (s: CardState, stability: number, due: string): FsrsState => ({
  due, stability, difficulty: 5, scheduledDays: 0, learningSteps: 0, reps: 1, lapses: 0, state: s, lastReview: null,
});

describe("dailyCounts", () => {
  it("counts answers per study day, oldest first, zero-filled", () => {
    const counts = dailyCounts(
      [review(0), review(MIN, Rating.Again, false), review(DAY), review(31 * DAY)],
      NOW,
      ISTANBUL,
    );
    expect(counts).toHaveLength(30);
    expect(counts.slice(-3)).toEqual([0, 1, 2]);
    expect(counts.reduce((a, b) => a + b)).toBe(3);
  });

  it("puts 03:30 local in the previous study day", () => {
    const night = "2026-10-25T00:30:00Z"; // 03:30 local
    const counts = dailyCounts([{ id: "n", reviewedAt: night, rating: Rating.Good, scheduled: true }], NOW, ISTANBUL);
    expect(counts.slice(-2)).toEqual([1, 0]);
  });
});

describe("retention", () => {
  it("is the share of non-Again answers on cards in review state", () => {
    const passed = [...graduated(20), review(5 * DAY, Rating.Good)];
    const failed = [...graduated(20), review(4 * DAY, Rating.Again)];
    expect(retention([passed, failed], NOW, 30)).toEqual({ rate: 0.5, total: 2 });
  });

  it("ignores learning steps, practice and answers outside the window", () => {
    const card = [...graduated(3), review(2 * DAY, Rating.Again, false)];
    expect(retention([card], NOW, 7)).toBeNull();
    const old = [...graduated(40), review(35 * DAY, Rating.Good)];
    expect(retention([old], NOW, 30)).toBeNull();
  });
});

describe("streak", () => {
  const days = (...ago: number[]) => ago.map((d) => review(d * DAY));

  it("counts consecutive study days up to today", () => {
    expect(streak(days(0, 1, 2, 4), NOW, ISTANBUL)).toEqual({ current: 3, longest: 3 });
  });

  it("stays alive until the end of today", () => {
    expect(streak(days(1, 2), NOW, ISTANBUL).current).toBe(2);
    expect(streak(days(2, 3), NOW, ISTANBUL).current).toBe(0);
  });

  it("remembers the longest run", () => {
    expect(streak(days(0, 10, 11, 12, 13, 14), NOW, ISTANBUL)).toEqual({ current: 1, longest: 5 });
    expect(streak([], NOW, ISTANBUL)).toEqual({ current: 0, longest: 0 });
  });
});

describe("stateCounts", () => {
  it("splits new, learning, young and mature cards", () => {
    const due = NOW;
    expect(
      stateCounts([
        undefined,
        state(CardState.Learning, 1, due),
        state(CardState.Relearning, 3, due),
        state(CardState.Review, 20.9, due),
        state(CardState.Review, 21, due),
      ]),
    ).toEqual({ new: 1, learning: 2, review: 1, mature: 1 });
  });
});

describe("forecast", () => {
  it("counts due cards per study day for a week, overdue in today", () => {
    const states = [
      state(CardState.Review, 5, at(3 * DAY)), // overdue
      state(CardState.Review, 5, "2026-10-26T00:00:00Z"), // 03:00 local tomorrow: still today
      state(CardState.Review, 5, "2026-10-26T01:00:00Z"), // 04:00 local: tomorrow
      state(CardState.Review, 5, at(-6 * DAY)),
      state(CardState.Review, 5, at(-7 * DAY)), // beyond the week
      undefined,
    ];
    expect(forecast(states, NOW, ISTANBUL)).toEqual([2, 1, 0, 0, 0, 0, 1]);
  });
});

describe("streakOfDays", () => {
  it("counts the run ending today or yesterday", () => {
    expect(streakOfDays([8, 9, 10], 10)).toEqual({ current: 3, longest: 3 });
    expect(streakOfDays([8, 9, 10], 11)).toEqual({ current: 3, longest: 3 });
  });

  it("breaks after a missed day and keeps the longest", () => {
    expect(streakOfDays([1, 2, 3, 4, 8, 9], 12)).toEqual({ current: 0, longest: 4 });
    expect(streakOfDays([], 12)).toEqual({ current: 0, longest: 0 });
  });
});

describe("weekday", () => {
  it("names the study day's weekday, Sunday = 0", () => {
    expect(weekday(dayKey("2026-10-27T09:00:00Z", 4, 180))).toBe(2); // Tuesday
    expect(weekday(dayKey("2026-10-27T00:30:00Z", 4, 180))).toBe(1); // 03:30 Tuesday is still Monday
  });
});
