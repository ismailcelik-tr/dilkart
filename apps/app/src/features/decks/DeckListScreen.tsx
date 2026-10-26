import { router } from "expo-router";
import { useCallback } from "react";

import { WeakStrip } from "@/features/weak/WeakStrip";
import { useLibrary, useLoad, useWeakWords } from "@/services/library";
import { Button, ButtonKind, Empty, Group, Row, Screen, SwipeToDelete } from "@/ui/components";

import { confirmRemoveDeck } from "./removeDeck";

export function DeckListScreen() {
  const lib = useLibrary();
  const weak = useWeakWords();
  const [data, reload] = useLoad(
    useCallback(
      async (l) => ({
        decks: await l.decks(),
        weak: (await weak.cards()).length,
        suggested: (await weak.suggestions()).length,
      }),
      [weak],
    ),
  );
  if (data === undefined) {
    return null;
  }

  const { decks } = data;

  return (
    <Screen>
      {decks.length === 0 ? (
        <>
          <Empty text="Henüz deste yok" />
          <Button title="Deste oluştur" kind={ButtonKind.Primary} onPress={() => router.push("/deck/new")} />
        </>
      ) : (
        <>
          <WeakStrip weak={data.weak} suggested={data.suggested} />
          <Button title="Tümünü çalış" kind={ButtonKind.Primary} onPress={() => router.push("/study")} />
          <Button title="Yeni deste" onPress={() => router.push("/deck/new")} />
          <Group>
            {decks.map((d) => (
              <SwipeToDelete
                key={d.id}
                label={`Sil: ${d.name}`}
                onDelete={() => confirmRemoveDeck(lib, d, d.cardCount, reload)}
              >
                <Row title={d.name} subtitle={`${d.cardCount} kart`} onPress={() => router.push(`/deck/${d.id}`)} />
              </SwipeToDelete>
            ))}
          </Group>
        </>
      )}
      <Button title="Hesap" onPress={() => router.push("/account")} />
      <Button title="Ayarlar" onPress={() => router.push("/settings")} />
      <Button title="Hakkında" onPress={() => router.push("/about")} />
    </Screen>
  );
}
