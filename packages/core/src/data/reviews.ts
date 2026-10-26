import type { Review } from "../fsrs/scheduler";
import { Table, type LocalStore } from "../sync/localStore";

/** A card's review logs in scheduler form. */
export async function reviewsOf(store: LocalStore, cardId: string): Promise<Review[]> {
  const logs = await store.select(Table.ReviewLogs, "card_id = ?", [cardId]);
  return logs.map((l) => ({
    id: String(l.id),
    reviewedAt: String(l.reviewed_at),
    rating: Number(l.rating),
    scheduled: l.scheduled !== false,
  }));
}
