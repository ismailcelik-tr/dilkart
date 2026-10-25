import { router } from "expo-router";
import { useCallback } from "react";
import { Appearance, useColorScheme } from "react-native";

import { useLibrary, useLoad } from "@/services/library";
import { rememberScheme, type Scheme } from "@/services/prefs";
import { Button, ButtonKind, Empty, Group, Row, Screen, SwipeToDelete, SwitchRow } from "@/ui/components";

import { confirmRemoveDeck } from "./removeDeck";

export function DeckListScreen() {
  const lib = useLibrary();
  const [decks, reload] = useLoad(useCallback((l) => l.decks(), []));
  const dark = useColorScheme() === "dark";
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
      <Button title="Hakkında" onPress={() => router.push("/about")} />
      <Group>
        <SwitchRow icon="moon.fill" title="Koyu görünüm" value={dark} onChange={(on) => setScheme(on ? "dark" : "light")} />
      </Group>
    </Screen>
  );
}

/** App-wide, native header and keyboard included. */
function setScheme(scheme: Scheme) {
  Appearance.setColorScheme(scheme);
  void rememberScheme(scheme);
}
