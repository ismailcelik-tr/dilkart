import type { Review } from "../fsrs/scheduler";
import { Table, type LocalStore } from "../sync/localStore";
import type { Values } from "../sync/merge";

const toReview = (l: Values): Review => ({
  id: String(l.id),
  reviewedAt: String(l.reviewed_at),
  rating: Number(l.rating),
  scheduled: l.scheduled !== false,
});

/** A card's review logs in scheduler form. */
export async function reviewsOf(store: LocalStore, cardId: string): Promise<Review[]> {
  const logs = await store.select(Table.ReviewLogs, "card_id = ?", [cardId]);
  return logs.map(toReview);
}

/** Every review log in scheduler form, by card id. */
export async function reviewsByCard(store: LocalStore): Promise<Map<string, Review[]>> {
  const byCard = new Map<string, Review[]>();
  for (const l of await store.select(Table.ReviewLogs, "1 = 1", [])) {
    const id = String(l.card_id);
    const list = byCard.get(id) ?? [];
    list.push(toReview(l));
    byCard.set(id, list);
  }
  return byCard;
}
