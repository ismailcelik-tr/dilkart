import { router } from "expo-router";
import { useCallback } from "react";

import { useLibrary, useLoad } from "@/services/library";
import { Button, ButtonKind, Empty, Group, Row, Screen, SwipeToDelete } from "@/ui/components";

import { confirmRemoveDeck } from "./removeDeck";

export function DeckListScreen() {
  const lib = useLibrary();
  const [decks, reload] = useLoad(useCallback((l) => l.decks(), []));
  if (decks === undefined) {
    return null;
  }

  return (
    <Screen>
      {decks.length === 0 ? (
        <>
          <Empty text="Henüz deste yok" />
          <Button title="Deste oluştur" kind={ButtonKind.Primary} onPress={() => router.push("/deck/new")} />
        </>
      ) : (
        <>
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
          <Button title="Tümünü çalış" kind={ButtonKind.Primary} onPress={() => router.push("/study")} />
          <Button title="Yeni deste" onPress={() => router.push("/deck/new")} />
        </>
      )}
      <Button title="Hesap" onPress={() => router.push("/account")} />
      <Button title="Lisanslar ve kaynaklar" onPress={() => router.push("/about/licenses")} />
      {__DEV__ && <Button title="Sözlük ölçümü" onPress={() => router.push("/dev/dictionary-bench")} />}
      {__DEV__ && <Button title="Liste ölçümü" onPress={() => router.push("/dev/deck-bench")} />}
    </Screen>
  );
}
