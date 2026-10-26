// Weak-word suggestion; docs/plan.md section 16, item 8. An error is an Again.
import { CardState, chronological, Rating, Scheduler, type Review } from "../fsrs/scheduler";

const MS_PER_DAY = 86_400_000;
const LAPSE_WINDOW_MS = 30 * MS_PER_DAY;
const MIN_LAPSES = 2;
const RECENT_REVIEWS = 8;
const MIN_ERROR_RATE = 0.4;
const WRONG_STREAK = 3;
const DISMISS_MS = 14 * MS_PER_DAY;
const RECOVERY_STREAK = 3;

export interface WeakStatus {
  isWeak: boolean;
  dismissedUntil?: string | null;
}

/** Practice reviews count as answers; only scheduled ones can be lapses. */
export function suggestWeak(reviews: Review[], now: string, status: WeakStatus): boolean {
  if (status.isWeak) {
    return false;
  }
  if (status.dismissedUntil && Date.parse(status.dismissedUntil) > Date.parse(now)) {
    return false;
  }

  const ordered = chronological(reviews);
  const errors = (rs: Review[]) => rs.filter((r) => r.rating === Rating.Again).length;

  const streak = ordered.slice(-WRONG_STREAK);
  if (streak.length === WRONG_STREAK && errors(streak) === WRONG_STREAK) {
    return true;
  }

  const recent = ordered.slice(-RECENT_REVIEWS);
  return lapses(ordered, now) >= MIN_LAPSES && errors(recent) / recent.length >= MIN_ERROR_RATE;
}

/** When a dismissed suggestion may come back. */
export const dismissUntil = (now: string) => new Date(Date.parse(now) + DISMISS_MS).toISOString();

/** A weak card recovers after this many answers in a row without an error since it was marked. */
export function recovered(reviews: Review[], since?: string): boolean {
  const from = since === undefined ? -Infinity : Date.parse(since);
  const last = chronological(reviews)
    .filter((r) => Date.parse(r.reviewedAt) > from)
    .slice(-RECOVERY_STREAK);
  return last.length === RECOVERY_STREAK && last.every((r) => r.rating !== Rating.Again);
}

// Retention does not change state transitions, so the default scheduler suffices.
const scheduler = new Scheduler();

/** Agains on a card in review state within the window, as FSRS counts lapses. */
function lapses(ordered: Review[], now: string): number {
  const since = Date.parse(now) - LAPSE_WINDOW_MS;
  return scheduler
    .history(ordered)
    .filter((s) => s.before?.state === CardState.Review && s.review.rating === Rating.Again)
    .filter((s) => Date.parse(s.review.reviewedAt) >= since).length;
}
