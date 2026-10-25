import { useCallback } from "react";

import { useLibrary, useLoad } from "@/services/library";
import { Empty, Group, Row, Screen } from "@/ui/components";
import { goBack } from "@/ui/navigation";

export function MoveCardScreen({ cardId }: { cardId: string }) {
  const lib = useLibrary();
  const data = useLoad(
    useCallback(async (l) => ({ card: await l.card(cardId), decks: await l.decks() }), [cardId]),
  );
  if (data === undefined) {
    return null;
  }

  const targets = data.decks.filter((d) => d.id !== data.card?.deckId);
  const move = async (deckId: string) => {
    await lib.moveCard(cardId, deckId);
    goBack(`/card/${cardId}`);
  };

  return (
    <Screen>
      {targets.length === 0 ? (
        <Empty text="Taşınacak başka deste yok" />
      ) : (
        <Group>
          {targets.map((d) => (
            <Row key={d.id} title={d.name} subtitle={`${d.cardCount} kart`} onPress={() => move(d.id)} />
          ))}
        </Group>
      )}
    </Screen>
  );
}
