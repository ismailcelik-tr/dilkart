// Weak-word suggestions and the weak list; docs/superpowers/specs/2026-10-26-weak-words-design.md.
import { Rating } from "../fsrs/scheduler";
import { Table, type Edit, type LocalStore } from "../sync/localStore";
import { dismissUntil, recovered, suggestWeak } from "../weak/weak";
import type { Card, Library } from "./library";
import { reviewsOf } from "./reviews";

// Both suggestion rules need a recent error, so only cards with one are checked.
const CANDIDATE_WINDOW_MS = 30 * 86_400_000;

export class WeakWords {
  constructor(
    private readonly store: LocalStore,
    private readonly library: Library,
    private readonly now: () => number = Date.now,
  ) {}

  async suggestions(): Promise<Card[]> {
    const now = this.timestamp();
    const since = new Date(this.now() - CANDIDATE_WINDOW_MS).toISOString();
    const errors = await this.store.select(Table.ReviewLogs, "rating = ? AND reviewed_at >= ?", [Rating.Again, since]);

    const found: Card[] = [];
    for (const id of new Set(errors.map((l) => String(l.card_id)))) {
      const card = await this.library.card(id);
      const row = await this.store.read(Table.Cards, id);
      if (card === undefined || row === undefined) {
        continue;
      }
      const status = { isWeak: card.isWeak, dismissedUntil: (row.weak_dismissed_until ?? null) as string | null };
      if (suggestWeak(await reviewsOf(this.store, id), now, status)) {
        found.push(card);
      }
    }
    return found.sort((a, b) => a.front.localeCompare(b.front, "tr"));
  }

  async cards(): Promise<Card[]> {
    return (await this.library.allCards()).filter((c) => c.isWeak);
  }

  /** Accepted cards become weak; rejected ones are not suggested for 14 days. */
  async decide(accepted: string[], rejected: string[]): Promise<void> {
    const now = this.timestamp();
    const until = dismissUntil(now);
    const edits: Edit[] = [
      ...accepted.map((id) => ({ table: Table.Cards, id, changes: { is_weak: true, weak_since: now } }) as Edit),
      ...rejected.map((id) => ({ table: Table.Cards, id, changes: { weak_dismissed_until: until } }) as Edit),
    ];
    if (edits.length > 0) {
      await this.store.writeAll(edits);
    }
  }

  /** Call after each answer: a recovered card leaves the weak list. */
  async review(cardId: string): Promise<void> {
    const row = await this.store.read(Table.Cards, cardId);
    if (row?.is_weak !== true) {
      return;
    }

    const since = row.weak_since == null ? undefined : String(row.weak_since);
    if (recovered(await reviewsOf(this.store, cardId), since)) {
      await this.store.write(Table.Cards, cardId, { is_weak: false, weak_since: null });
    }
  }

  private timestamp(): string {
    return new Date(this.now()).toISOString();
  }
}
