import type { Library } from "@dilkart/core";

import { confirm } from "@/ui/confirm";

export async function confirmRemoveCard(lib: Library, card: { id: string; front: string }, onDone: () => void) {
  if (!(await confirm("Kartı sil", `${card.front} silinecek.`, "Sil"))) {
    return;
  }

  await lib.removeCard(card.id);
  onDone();
}
