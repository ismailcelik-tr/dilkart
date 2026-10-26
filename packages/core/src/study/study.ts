// What to study now and how answers are recorded; docs/plan.md section 16, items 5 and Aşama 5.
import type { Card, Library } from "../data/library";
import { reviewsOf } from "../data/reviews";
import { Settings } from "../data/settings";
import { WeakWords } from "../data/weakWords";
import type { SqlReader } from "../dictionary/lookup";
import { dayKey, dayStart } from "../fsrs/day";
import { schedules, type Module, type SessionKind } from "../fsrs/policy";
import { CardState, Rating, Scheduler, type FsrsState } from "../fsrs/scheduler";
import { uuidv7 } from "../sync/id";
import { Table, type LocalStore } from "../sync/localStore";

export interface StudyContext {
  session: SessionKind;
  module: Module;
}

export interface Plan {
  cards: Card[];
  counts: { learning: number; review: number; new: number };
}

// One new card after every this many reviews.
const NEW_EVERY = 5;
const RATINGS = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

const isLearning = (s: FsrsState) => s.state === CardState.Learning || s.state === CardState.Relearning;
const byDue = (a: Card, b: Card) => (a.fsrs?.due ?? "").localeCompare(b.fsrs?.due ?? "");
const byCreation = (a: Card, b: Card) => a.id.localeCompare(b.id);

/** Device minutes east of UTC, the review_logs.tz_offset_min convention. */
const deviceOffset = () => -new Date().getTimezoneOffset();

export class Study {
  private readonly scheduler: Scheduler;
  private readonly weak: WeakWords;

  constructor(
    private readonly store: LocalStore,
    private readonly library: Library,
    private readonly reader: SqlReader,
    private readonly settings: Settings = new Settings(store),
    private readonly now: () => number = Date.now,
    private readonly tzOffsetMin: () => number = deviceOffset,
  ) {
    this.scheduler = new Scheduler();
    this.weak = new WeakWords(store, library, now);
  }

  /** Due learning steps, then reviews (most overdue first) with new cards spread among them. */
  async plan(deckId?: string): Promise<Plan> {
    const { dayStartHour, newPerDay, reviewsPerDay } = await this.settings.get();
    const cards = deckId === undefined ? await this.library.allCards() : await this.library.cards(deckId);
    const today = dayKey(new Date(this.now()), dayStartHour, this.tzOffsetMin());
    const endOfDay = dayStart(today + 1, dayStartHour, this.tzOffsetMin()).toISOString();
    const done = await this.doneToday(dayStart(today, dayStartHour, this.tzOffsetMin()).toISOString());

    const learning = cards.filter((c) => c.fsrs && isLearning(c.fsrs) && c.fsrs.due < endOfDay).sort(byDue);
    const reviews = cards
      .filter((c) => c.fsrs?.state === CardState.Review && c.fsrs.due < endOfDay)
      .sort(byDue)
      .slice(0, Math.max(0, reviewsPerDay - done.reviews));
    const fresh = cards
      .filter((c) => c.fsrs === undefined)
      .sort(byCreation)
      .slice(0, Math.max(0, newPerDay - done.new));

    const mixed: Card[] = [];
    let n = 0;
    for (const [i, card] of reviews.entries()) {
      mixed.push(card);
      if ((i + 1) % NEW_EVERY === 0 && n < fresh.length) {
        mixed.push(fresh[n++] as Card);
      }
    }
    mixed.push(...fresh.slice(n));

    return {
      cards: [...learning, ...mixed],
      counts: { learning: learning.length, review: reviews.length, new: fresh.length },
    };
  }

  /** Records an answer; updates the schedule only when policy says it counts. */
  async answer(card: Card, rating: Rating, ctx: StudyContext, elapsedMs: number): Promise<Card> {
    const at = new Date(this.now()).toISOString();
    const tzOffsetMin = this.tzOffsetMin();
    const { dayStartHour } = await this.settings.get();
    const scheduled = schedules(card.fsrs, at, { ...ctx, dayStartHour, tzOffsetMin });

    await this.store.append(uuidv7(this.now()), {
      card_id: card.id,
      reviewed_at: at,
      rating,
      mode: ctx.module,
      tz_offset_min: tzOffsetMin,
      elapsed_ms: Math.round(elapsedMs),
      scheduled,
    });
    await this.weak.review(card.id);
    if (!scheduled) {
      return card;
    }

    const fsrs = this.scheduler.rate(card.fsrs, rating, at);
    await this.store.cacheFsrs(card.id, fsrs);
    return { ...card, fsrs };
  }

  /** Milliseconds until the card would be due after each rating. */
  intervals(card: Card): Record<Rating, number> {
    const at = new Date(this.now()).toISOString();
    const entries = RATINGS.map((r) => [r, Date.parse(this.scheduler.rate(card.fsrs, r, at).due) - this.now()]);
    return Object.fromEntries(entries) as Record<Rating, number>;
  }

  /** Rebuilds cached states from logs, e.g. after sync pulled another device's reviews. */
  async refresh(cardIds: string[]): Promise<void> {
    for (const id of cardIds) {
      await this.store.cacheFsrs(id, this.scheduler.replay(await reviewsOf(this.store, id)) ?? null);
    }
  }

  /** New cards introduced and review cards answered since `since`, across all decks. */
  private async doneToday(since: string): Promise<{ new: number; reviews: number }> {
    const rows = await this.reader.all<{ card_id: string; first: string }>(
      `SELECT card_id, min(reviewed_at) AS first FROM ${Table.ReviewLogs}
       WHERE coalesce(scheduled, 1) = 1 GROUP BY card_id HAVING max(reviewed_at) >= ?`,
      [since],
    );
    const fresh = rows.filter((r) => r.first >= since).length;
    return { new: fresh, reviews: rows.length - fresh };
  }
}
