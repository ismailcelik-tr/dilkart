// FSRS-6 via ts-fsrs. A card's state is derived from its review logs (ADR 0003),
// so every device replaying the same logs reaches the same state.
import { createEmptyCard, fsrs, generatorParameters, type Card, type FSRS, type Grade } from "ts-fsrs";

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

/** Stored as cards.fsrs_state. */
export interface FsrsState {
  due: string;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview: string | null;
}

export interface Review {
  id: string;
  reviewedAt: string;
  rating: Rating;
  /** False for practice; see policy.schedules. */
  scheduled: boolean;
}

export interface Step {
  review: Review;
  before: FsrsState | undefined;
  after: FsrsState;
}

export const DEFAULT_RETENTION = 0.9;

// New cards start at the epoch: FSRS ignores due for state New, and a fixed
// value keeps replay independent of when the card was created.
const NEW_CARD_DUE = new Date(0);

export class Scheduler {
  private readonly f: FSRS;

  // Fuzz off: spreading intervals randomly would break replay determinism checks.
  constructor(desiredRetention = DEFAULT_RETENTION) {
    this.f = fsrs(generatorParameters({ request_retention: desiredRetention, enable_fuzz: false }));
  }

  rate(state: FsrsState | undefined, rating: Rating, at: string): FsrsState {
    const card = state ? toCard(state) : createEmptyCard(NEW_CARD_DUE);
    return fromCard(this.f.next(card, new Date(at), rating as number as Grade).card);
  }

  /** State after the scheduled reviews in time order; undefined while the card is new. */
  replay(reviews: Review[]): FsrsState | undefined {
    return this.history(reviews).at(-1)?.after;
  }

  /** Each scheduled review with the state it met and the state it left. */
  history(reviews: Review[]): Step[] {
    const steps: Step[] = [];
    let before: FsrsState | undefined;
    for (const review of chronological(reviews).filter((r) => r.scheduled)) {
      const after = this.rate(before, review.rating, review.reviewedAt);
      steps.push({ review, before, after });
      before = after;
    }
    return steps;
  }
}

/** Time order with id as tie-break, identical on every device. */
export const chronological = (reviews: Review[]) =>
  [...reviews].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt) || a.id.localeCompare(b.id));

function toCard(s: FsrsState): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: 0,
    scheduled_days: s.scheduledDays,
    learning_steps: s.learningSteps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as number,
    last_review: s.lastReview === null ? undefined : new Date(s.lastReview),
  };
}

function fromCard(c: Card): FsrsState {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as number,
    lastReview: c.last_review?.toISOString() ?? null,
  };
}
