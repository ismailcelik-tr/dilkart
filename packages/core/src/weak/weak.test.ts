import { describe, expect, it } from "vitest";

import { Rating, type Review } from "../fsrs/scheduler";
import { dismissUntil, suggestWeak } from "./weak";

const NOW = Date.parse("2026-10-25T06:00:00Z");
const MIN = 60_000;
const DAY = 86_400_000;

let seq = 0;
const review = (msAgo: number, rating: Rating, scheduled = true): Review => ({
  id: String(seq++).padStart(4, "0"),
  reviewedAt: new Date(NOW - msAgo).toISOString(),
  rating,
  scheduled,
});

/** Learned well before the window, so later Agains are lapses. */
const graduated = () => [review(60 * DAY, Rating.Good), review(60 * DAY - 10 * MIN, Rating.Good)];

/** A lapse `daysAgo` and its relearning step. */
const lapse = (daysAgo: number) => [review(daysAgo * DAY, Rating.Again), review(daysAgo * DAY - 10 * MIN, Rating.Good)];

const suggest = (reviews: Review[], dismissedUntil?: string) =>
  suggestWeak(reviews, new Date(NOW).toISOString(), { isWeak: false, dismissedUntil });

describe("suggestWeak", () => {
  it("ignores a single wrong answer", () => {
    expect(suggest([...graduated(), review(DAY, Rating.Again)])).toBe(false);
  });

  // A = Again, G = Good, p = practice (not a lapse). Histories start with G G (graduated).
  const practiceAgain = (daysAgo: number) => review(daysAgo * DAY, Rating.Again, false);

  it("suggests at two lapses and 4 errors in the last 8", () => {
    // G G A G A G A(p) A(p) → lapses 2, errors 4/8
    expect(suggest([...graduated(), ...lapse(20), ...lapse(10), practiceAgain(5), practiceAgain(4)])).toBe(true);
    // G G A G A G A(p) G → lapses 2, errors 3/8
    expect(suggest([...graduated(), ...lapse(20), ...lapse(10), practiceAgain(5), review(4 * DAY, Rating.Good)])).toBe(false);
  });

  it("puts the error-rate threshold at 40%", () => {
    // G G A G A → lapses 2, errors 2/5 = 40%
    const atThreshold = [...graduated(), ...lapse(20), review(10 * DAY, Rating.Again)];
    expect(suggest(atThreshold)).toBe(true);
    // G G A G A G → 2/6 = 33%
    expect(suggest([...atThreshold, review(9 * DAY, Rating.Good)])).toBe(false);
  });

  it("requires the second lapse", () => {
    // G G A G A(p) A(p) G → lapses 1, errors 3/7 = 43%
    expect(suggest([...graduated(), ...lapse(10), practiceAgain(5), practiceAgain(4), review(3 * DAY, Rating.Good)])).toBe(false);
  });

  it("counts lapses only inside the 30-day window", () => {
    const tail = [practiceAgain(5), practiceAgain(4)];
    expect(suggest([...graduated(), ...lapse(29), ...lapse(10), ...tail])).toBe(true);
    expect(suggest([...graduated(), ...lapse(31), ...lapse(10), ...tail])).toBe(false);
  });

  it("suggests after three wrong answers in a row", () => {
    const two = [...graduated(), practiceAgain(3), practiceAgain(2)];
    expect(suggest(two)).toBe(false);
    expect(suggest([...two, practiceAgain(1)])).toBe(true);
  });

  it("stays quiet for weak or recently dismissed cards", () => {
    const struggling = [...graduated(), practiceAgain(3), practiceAgain(2), practiceAgain(1)];
    const nowIso = new Date(NOW).toISOString();
    expect(suggestWeak(struggling, nowIso, { isWeak: true })).toBe(false);
    expect(suggest(struggling, new Date(NOW + MIN).toISOString())).toBe(false);
    expect(suggest(struggling, new Date(NOW - MIN).toISOString())).toBe(true);
  });

  it("dismisses for 14 days", () => {
    expect(dismissUntil(new Date(NOW).toISOString())).toBe(new Date(NOW + 14 * DAY).toISOString());
  });
});
