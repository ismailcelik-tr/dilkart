import { router, Stack } from "expo-router";
import { useCallback } from "react";

import { useLibrary, useLoad } from "@/services/library";
import { CardList } from "@/features/cards/CardList";
import { confirmRemoveDeck } from "@/features/decks/removeDeck";
import { Button, ButtonKind, Empty } from "@/ui/components";
import { goBack } from "@/ui/navigation";

export function DeckScreen({ deckId }: { deckId: string }) {
  const lib = useLibrary();
  const data = useLoad(
    useCallback(
      async (l) => ({ deck: (await l.decks()).find((d) => d.id === deckId), cards: await l.cards(deckId) }),
      [deckId],
    ),
  );
  if (data === undefined) {
    return null;
  }

  const { deck, cards } = data;
  if (deck === undefined) {
    return <Empty text="Deste bulunamadı" />;
  }

  const remove = () => confirmRemoveDeck(lib, deck, cards.length, () => goBack("/"));

  return (
    <>
      <Stack.Screen options={{ title: deck.name }} />
      <CardList
        cards={cards}
        empty={<Empty text="Bu destede kart yok" />}
        footer={
          <>
            <Button
              title="Çalış"
              kind={ButtonKind.Primary}
              onPress={() => router.push({ pathname: "/study", params: { deckId } })}
            />
            <Button
              title="Kart ekle"
              onPress={() => router.push({ pathname: "/card/new", params: { deckId } })}
            />
            <Button title="Yeniden adlandır" onPress={() => router.push(`/deck/${deckId}/rename`)} />
            <Button title="Desteyi sil" kind={ButtonKind.Danger} onPress={remove} />
          </>
        }
      />
    </>
  );
}
