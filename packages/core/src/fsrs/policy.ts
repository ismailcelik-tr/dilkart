// Which study answers move the schedule; docs/plan.md section 16, item 5.
import { Verdict } from "../text/answer";
import { dayKey } from "./day";
import { CardState, Rating, type FsrsState } from "./scheduler";

/** Stored as review_logs.mode. */
export enum Module {
  Recall = 1,
  Reverse = 2,
  Typing = 3,
  Listening = 4,
  Match = 5,
}

export enum SessionKind {
  Review = "review",
  Free = "free",
  Weak = "weak",
}

export interface ScheduleContext {
  session: SessionKind;
  module: Module;
  dayStartHour: number;
  tzOffsetMin: number;
}

/** Whether an answer at `at` updates FSRS; false means practice (review_logs.scheduled). */
export function schedules(state: FsrsState | undefined, at: string, ctx: ScheduleContext): boolean {
  if (ctx.session !== SessionKind.Review || ctx.module === Module.Match) {
    return false;
  }
  if (state === undefined || Date.parse(state.due) <= Date.parse(at)) {
    return true;
  }
  // Minute-long learning steps may be answered early within a session.
  if (state.state === CardState.Learning || state.state === CardState.Relearning) {
    return true;
  }
  if (state.lastReview === null) {
    return true;
  }

  const day = (t: string) => dayKey(t, ctx.dayStartHour, ctx.tzOffsetMin);
  return day(state.lastReview) !== day(at);
}

const GRADES: Record<Verdict, Rating> = {
  [Verdict.Correct]: Rating.Good,
  [Verdict.Almost]: Rating.Hard,
  [Verdict.Wrong]: Rating.Again,
};

/** Rating for the typing and listening modules; recall modules let the user pick. */
export const gradeFor = (verdict: Verdict) => GRADES[verdict];
