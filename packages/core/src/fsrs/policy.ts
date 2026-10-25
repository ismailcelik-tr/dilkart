// Which study answers move the schedule; docs/plan.md section 16, item 5.
import { dayKey } from "./day";
import type { FsrsState } from "./scheduler";

/** Stored as review_logs.mode. */
export enum Module {
  Recall = 1,
  Reverse = 2,
  Typing = 3,
  Listening = 4,
  Match = 5,
}

export enum Session {
  Review = "review",
  Free = "free",
  Weak = "weak",
}

export interface StudyContext {
  session: Session;
  module: Module;
  dayStartHour: number;
  tzOffsetMin: number;
}

/** Whether an answer at `at` updates FSRS; false means practice (review_logs.scheduled). */
export function schedules(state: FsrsState | undefined, at: string, ctx: StudyContext): boolean {
  if (ctx.session !== Session.Review || ctx.module === Module.Match) {
    return false;
  }
  if (state === undefined || Date.parse(state.due) <= Date.parse(at)) {
    return true;
  }
  if (state.lastReview === null) {
    return true;
  }

  const day = (t: string) => dayKey(t, ctx.dayStartHour, ctx.tzOffsetMin);
  return day(state.lastReview) !== day(at);
}
