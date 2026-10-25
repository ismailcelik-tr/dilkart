// Statistics from review logs and derived FSRS states; docs/plan.md section 16.
import { dayKey } from "../fsrs/day";
import { CardState, Rating, Scheduler, type FsrsState, type Review } from "../fsrs/scheduler";

export interface DayContext {
  dayStartHour: number;
  tzOffsetMin: number;
}

export interface StateCounts {
  new: number;
  learning: number;
  review: number;
  mature: number;
}

const MS_PER_DAY = 86_400_000;
const HISTORY_DAYS = 30;
const FORECAST_DAYS = 7;
// Anki's convention for a well-learned card.
const MATURE_STABILITY_DAYS = 21;

// Retention does not change state transitions, so the default scheduler suffices.
const scheduler = new Scheduler();

const day = (t: string, ctx: DayContext) => dayKey(t, ctx.dayStartHour, ctx.tzOffsetMin);

/** Answers per study day, oldest first; the last entry is today. */
export function dailyCounts(reviews: Review[], now: string, ctx: DayContext, days = HISTORY_DAYS): number[] {
  const today = day(now, ctx);
  const counts = new Array<number>(days).fill(0);
  for (const r of reviews) {
    const i = days - 1 - (today - day(r.reviewedAt, ctx));
    if (i >= 0 && i < days) {
      counts[i] = (counts[i] ?? 0) + 1;
    }
  }
  return counts;
}

/** Share of non-Again answers on cards in review state; null without such answers. */
export function retention(reviewsByCard: Review[][], now: string, days: number): { rate: number; total: number } | null {
  const since = Date.parse(now) - days * MS_PER_DAY;
  const answers = reviewsByCard
    .flatMap((reviews) => scheduler.history(reviews))
    .filter((s) => s.before?.state === CardState.Review && Date.parse(s.review.reviewedAt) >= since);

  if (answers.length === 0) {
    return null;
  }
  const passed = answers.filter((s) => s.review.rating !== Rating.Again).length;
  return { rate: passed / answers.length, total: answers.length };
}

/** Consecutive study days; today's streak survives until today ends. */
export function streak(reviews: Review[], now: string, ctx: DayContext): { current: number; longest: number } {
  const studied = [...new Set(reviews.map((r) => day(r.reviewedAt, ctx)))].sort((a, b) => a - b);

  let longest = 0;
  let run = 0;
  for (const [i, d] of studied.entries()) {
    run = i > 0 && d - (studied[i - 1] ?? 0) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const last = studied.at(-1);
  const today = day(now, ctx);
  const current = last !== undefined && today - last <= 1 ? run : 0;
  return { current, longest };
}

export function stateCounts(states: (FsrsState | undefined)[]): StateCounts {
  const counts: StateCounts = { new: 0, learning: 0, review: 0, mature: 0 };
  for (const s of states) {
    if (s === undefined || s.state === CardState.New) {
      counts.new++;
    } else if (s.state !== CardState.Review) {
      counts.learning++;
    } else if (s.stability >= MATURE_STABILITY_DAYS) {
      counts.mature++;
    } else {
      counts.review++;
    }
  }
  return counts;
}

/** Due cards per study day from today; overdue cards count as today. */
export function forecast(states: (FsrsState | undefined)[], now: string, ctx: DayContext, days = FORECAST_DAYS): number[] {
  const today = day(now, ctx);
  const counts = new Array<number>(days).fill(0);
  for (const s of states) {
    if (s === undefined) {
      continue;
    }
    const i = Math.max(0, day(s.due, ctx) - today);
    if (i < days) {
      counts[i] = (counts[i] ?? 0) + 1;
    }
  }
  return counts;
}
