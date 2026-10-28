// Home streak row and statistics page; docs/superpowers/specs/2026-10-27-stats-design.md.
import { dayKey, deviceOffset } from "../fsrs/day";
import {
  dailyCounts,
  forecast,
  retention,
  stateCounts,
  streak,
  streakOfDays,
  type Retention,
  type StateCounts,
} from "../stats/stats";
import type { LocalStore } from "../sync/localStore";
import type { Library } from "./library";
import { reviewsByCard } from "./reviews";
import type { Settings } from "./settings";

const WEEK = 7;
const MONTH = 30;

export interface Today {
  streak: number;
  answers: number;
  /** GOAL_OFF when off. */
  goal: number;
}

export interface Report {
  /** Today's study day number, for weekday labels. */
  today: number;
  streak: { current: number; longest: number };
  /** Answers per day, last 30 days, oldest first. */
  daily: number[];
  goal: number;
  retention7: Retention | null;
  retention30: Retention | null;
  states: StateCounts;
  /** Due cards per day, next 7 days from today. */
  forecast: number[];
}

export class Stats {
  constructor(
    private readonly store: LocalStore,
    private readonly library: Library,
    private readonly settings: Settings,
    private readonly now: () => number = Date.now,
    private readonly tzOffsetMin: () => number = deviceOffset,
  ) {}

  /** Cheap enough for every home screen load: one grouped query, no log rows. */
  async today(): Promise<Today> {
    const { dayStartHour, dailyGoal } = await this.settings.get();
    const tz = this.tzOffsetMin();
    const perDay = await this.store.answersPerDay(dayStartHour, tz);
    const today = dayKey(new Date(this.now()), dayStartHour, tz);
    return {
      streak: streakOfDays(perDay.map((d) => d.day), today).current,
      answers: perDay.find((d) => d.day === today)?.count ?? 0,
      goal: dailyGoal,
    };
  }

  async report(): Promise<Report> {
    const { dayStartHour, dailyGoal } = await this.settings.get();
    const ctx = { dayStartHour, tzOffsetMin: this.tzOffsetMin() };
    const now = new Date(this.now()).toISOString();
    const byCard = [...(await reviewsByCard(this.store)).values()];
    const reviews = byCard.flat();
    const states = (await this.library.allCards()).map((c) => c.fsrs);
    return {
      today: dayKey(now, dayStartHour, ctx.tzOffsetMin),
      streak: streak(reviews, now, ctx),
      daily: dailyCounts(reviews, now, ctx),
      goal: dailyGoal,
      retention7: retention(byCard, now, WEEK),
      retention30: retention(byCard, now, MONTH),
      states: stateCounts(states),
      forecast: forecast(states, now, ctx),
    };
  }
}
