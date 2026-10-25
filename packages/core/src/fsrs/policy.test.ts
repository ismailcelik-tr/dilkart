import { describe, expect, it } from "vitest";

import { Verdict } from "../text/answer";
import { gradeFor, Module, schedules, Session, type StudyContext } from "./policy";
import { Rating, Scheduler } from "./scheduler";

const REVIEW: StudyContext = { session: Session.Review, module: Module.Recall, dayStartHour: 4, tzOffsetMin: 180 };
const scheduler = new Scheduler();

// Learned at 10:00 Istanbul; next due several days later.
const learned = (() => {
  let s = scheduler.rate(undefined, Rating.Good, "2026-10-25T07:00:00Z");
  s = scheduler.rate(s, Rating.Good, "2026-10-25T07:10:00Z");
  return scheduler.rate(s, Rating.Good, "2026-10-26T07:00:00Z");
})();

describe("schedules", () => {
  it("counts a new card", () => {
    expect(schedules(undefined, "2026-10-25T07:00:00Z", REVIEW)).toBe(true);
  });

  it("counts a due card", () => {
    expect(schedules(learned, learned.due, REVIEW)).toBe(true);
  });

  it("treats a not-yet-due card studied again the same day as practice", () => {
    expect(schedules(learned, "2026-10-26T18:00:00Z", REVIEW)).toBe(false); // 21:00 local
    expect(schedules(learned, "2026-10-27T00:30:00Z", REVIEW)).toBe(false); // 03:30 local, same study day
  });

  it("counts studying ahead on a later study day", () => {
    expect(schedules(learned, "2026-10-27T01:00:00Z", REVIEW)).toBe(true); // 04:00 local
  });

  it("never counts the match module or practice sessions", () => {
    expect(schedules(undefined, "2026-10-25T07:00:00Z", { ...REVIEW, module: Module.Match })).toBe(false);
    expect(schedules(learned, learned.due, { ...REVIEW, session: Session.Free })).toBe(false);
    expect(schedules(learned, learned.due, { ...REVIEW, session: Session.Weak })).toBe(false);
  });
});

describe("gradeFor", () => {
  it("maps typed answers to FSRS ratings", () => {
    expect([Verdict.Correct, Verdict.Almost, Verdict.Wrong].map(gradeFor)).toEqual([Rating.Good, Rating.Hard, Rating.Again]);
  });
});
