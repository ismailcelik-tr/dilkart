import { router } from "expo-router";
import { useCallback } from "react";

import { useLoad } from "@/services/library";
import { Button, ButtonKind, Empty, Group, Row, Screen } from "@/ui/components";

export function DeckListScreen() {
  const decks = useLoad(useCallback((lib) => lib.decks(), []));
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
              <Row key={d.id} title={d.name} subtitle={`${d.cardCount} kart`} onPress={() => router.push(`/deck/${d.id}`)} />
            ))}
          </Group>
          <Button title="Tümünü çalış" kind={ButtonKind.Primary} onPress={() => router.push("/study")} />
          <Button title="Yeni deste" onPress={() => router.push("/deck/new")} />
        </>
      )}
      {__DEV__ && <Button title="Sözlük ölçümü" onPress={() => router.push("/dev/dictionary-bench")} />}
      {__DEV__ && <Button title="Liste ölçümü" onPress={() => router.push("/dev/deck-bench")} />}
    </Screen>
  );
}
