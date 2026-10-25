import { router, Stack } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";

import { useLibrary, useLoad } from "@/services/library";
import { Button, ButtonKind, Empty, Group, Row, Screen } from "@/ui/components";
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

  const remove = () =>
    Alert.alert("Desteyi sil", `${deck.name} ve içindeki ${cards.length} kart silinecek.`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await lib.removeDeck(deckId);
          goBack("/");
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: deck.name }} />
      {cards.length === 0 ? (
        <Empty text="Bu destede kart yok" />
      ) : (
        <Group>
          {cards.map((c) => (
            <Row
              key={c.id}
              title={c.usageLabel ? `${c.front} · ${c.usageLabel}` : c.front}
              subtitle={c.meanings.map((m) => m.tr).join(", ")}
              onPress={() => router.push(`/card/${c.id}`)}
            />
          ))}
        </Group>
      )}
      <Button
        title="Kart ekle"
        kind={ButtonKind.Primary}
        onPress={() => router.push({ pathname: "/card/new", params: { deckId } })}
      />
      <Button title="Yeniden adlandır" onPress={() => router.push(`/deck/${deckId}/rename`)} />
      <Button title="Desteyi sil" kind={ButtonKind.Danger} onPress={remove} />
    </Screen>
  );
}
