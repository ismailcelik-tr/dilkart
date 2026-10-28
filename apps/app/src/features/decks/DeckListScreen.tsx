import { router } from "expo-router";
import { useCallback, useEffect } from "react";

import { StreakRow } from "@/features/stats/StreakRow";
import { WeakStrip } from "@/features/weak/WeakStrip";
import { useAccount, useLibrary, useLoad, useStats, useWeakWords } from "@/services/library";
import { askReminders } from "@/services/reminders";
import { Button, ButtonKind, Empty, Group, Row, Screen, SwipeToDelete } from "@/ui/components";
import { IS_WEB } from "@/ui/platform";

import { confirmRemoveDeck } from "./removeDeck";

export function DeckListScreen() {
  const lib = useLibrary();
  const weak = useWeakWords();
  const stats = useStats();
  const account = useAccount();
  useEffect(() => {
    void askReminders(stats);
  }, [stats]);

  const [data, reload] = useLoad(
    useCallback(
      async (l) => ({
        decks: await l.decks(),
        weak: (await weak.cards()).length,
        suggested: (await weak.suggestions()).length,
        today: await stats.today(),
      }),
      [weak, stats],
    ),
  );
  if (data === undefined) {
    return null;
  }

  // Web only manages an account's cards; guest cards there would never reach the phone.
  if (IS_WEB && account.email === undefined) {
    return (
      <Screen>
        <Empty text="Kartlarını telefona aktarmak için giriş yap" />
        <Button title="Giriş yap" kind={ButtonKind.Primary} onPress={() => router.push("/account")} />
        <Button title="Hakkında" onPress={() => router.push("/about")} />
      </Screen>
    );
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
          {!IS_WEB && (
            <>
              <WeakStrip weak={data.weak} suggested={data.suggested} />
              <StreakRow today={data.today} />
              <Button title="Tümünü çalış" kind={ButtonKind.Primary} onPress={() => router.push("/study")} />
            </>
          )}
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
      {!IS_WEB && <Button title="İstatistikler" onPress={() => router.push("/stats")} />}
      <Button title="Hesap" onPress={() => router.push("/account")} />
      {!IS_WEB && <Button title="Ayarlar" onPress={() => router.push("/settings")} />}
      <Button title="Hakkında" onPress={() => router.push("/about")} />
    </Screen>
  );
}
