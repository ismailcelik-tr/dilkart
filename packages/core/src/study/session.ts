// One study sitting: walks the plan and brings learning steps back when due.
import type { Card } from "../data/library";
import { CardState, type Rating } from "../fsrs/scheduler";
import type { Study, StudyContext } from "./study";

// Like Anki's learn-ahead limit: with nothing else left, show steps due this soon.
const LEARN_AHEAD_MS = 20 * 60_000;

export class Session {
  private readonly queue: Card[];
  private learning: Card[] = [];
  private done = 0;
  private shownAt: number;

  constructor(
    cards: Card[],
    private readonly study: Study,
    readonly ctx: StudyContext,
    private readonly now: () => number = Date.now,
  ) {
    this.queue = [...cards];
    this.shownAt = now();
  }

  current(): Card | undefined {
    const now = this.now();
    const [step] = this.learning;
    if (step && Date.parse(step.fsrs?.due ?? "") <= now) {
      return step;
    }
    if (this.queue.length > 0) {
      return this.queue[0];
    }
    if (step && Date.parse(step.fsrs?.due ?? "") <= now + LEARN_AHEAD_MS) {
      return step;
    }
    return undefined;
  }

  async answer(rating: Rating, elapsedMs = this.now() - this.shownAt): Promise<Card> {
    const card = this.current();
    if (card === undefined) {
      throw new Error("session finished");
    }

    const answered = await this.study.answer(card, rating, this.ctx, elapsedMs);
    this.learning = this.learning.filter((c) => c !== card);
    const index = this.queue.indexOf(card);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }

    const state = answered.fsrs?.state;
    if (answered !== card && (state === CardState.Learning || state === CardState.Relearning)) {
      this.learning = [...this.learning, answered].sort(
        (a, b) => Date.parse(a.fsrs?.due ?? "") - Date.parse(b.fsrs?.due ?? ""),
      );
    }

    this.done++;
    this.shownAt = this.now();
    return answered;
  }

  progress(): { done: number; left: number } {
    return { done: this.done, left: this.queue.length + this.learning.length };
  }
}
