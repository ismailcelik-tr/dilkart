import type { Library } from "@dilkart/core";

import { confirm } from "@/ui/confirm";

/** Asks first: a deck takes its cards with it (plan section 16, stage 4 decision). */
export async function confirmRemoveDeck(lib: Library, deck: { id: string; name: string }, cardCount: number, onDone: () => void) {
  if (!(await confirm("Desteyi sil", `${deck.name} ve içindeki ${cardCount} kart silinecek.`, "Sil"))) {
    return;
  }

  await lib.removeDeck(deck.id);
  onDone();
}
