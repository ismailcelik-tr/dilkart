import { matchRound, Module, Rating, SessionKind, type Card, type MatchItem, type MatchRound } from "@dilkart/core";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useLibrary, useStudy, useWeakWords } from "@/services/library";
import { Button, ButtonKind, Empty, Screen } from "@/ui/components";
import { RADIUS, SPACE, useTheme } from "@/ui/theme";

import { practiceCards } from "./cards";

const PRACTICE = { session: SessionKind.Free, module: Module.Match };

type Side = "left" | "right";

export function MatchScreen({ deckId, kind }: { deckId?: string; kind: SessionKind }) {
  const lib = useLibrary();
  const weak = useWeakWords();
  const study = useStudy();
  const [cards, setCards] = useState<Map<string, Card>>();
  const [round, setRound] = useState<MatchRound>();
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Partial<Record<Side, string>>>({});

  const newRound = useCallback((all: Map<string, Card>) => {
    setRound(matchRound([...all.values()]));
    setMatched(new Set());
    setPicked({});
  }, []);

  useEffect(() => {
    (async () => {
      const list = await practiceCards(lib, weak, kind, deckId);
      const all = new Map(list.map((c) => [c.id, c]));
      setCards(all);
      newRound(all);
    })();
  }, [lib, weak, kind, deckId, newRound]);

  if (cards === undefined) {
    return null;
  }
  if (round === undefined) {
    return <Empty text="Eşleştirme için yeterli kart yok." />;
  }

  const pick = async (side: Side, item: MatchItem) => {
    const next = { ...picked, [side]: item.cardId };
    if (next.left === undefined || next.right === undefined) {
      setPicked(next);
      return;
    }

    setPicked({});
    const card = cards.get(next.left);
    if (card === undefined) {
      return;
    }
    const correct = next.left === next.right;
    await study.answer(card, correct ? Rating.Good : Rating.Again, PRACTICE, 0);
    if (correct) {
      setMatched(new Set(matched).add(card.id));
    }
  };

  if (matched.size === round.left.length) {
    return (
      <Screen>
        <Empty text="Tur bitti" />
        <Button title="Yeni tur" kind={ButtonKind.Primary} onPress={() => newRound(cards)} />
        <Button title="Bitir" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.columns}>
        {(["left", "right"] as const).map((side) => (
          <View key={side} style={styles.column}>
            {round[side].map((item) =>
              matched.has(item.cardId) ? (
                <View key={item.cardId} style={styles.gone} />
              ) : (
                <Tile key={item.cardId} text={item.text} selected={picked[side] === item.cardId} onPress={() => pick(side, item)} />
              ),
            )}
          </View>
        ))}
      </View>
    </Screen>
  );
}

function Tile({ text, selected, onPress }: { text: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tile, { backgroundColor: selected ? theme.tint : theme.surface }]}
    >
      <Text style={[styles.tileText, { color: selected ? "#FFFFFF" : theme.text }]}>{text}</Text>
    </Pressable>
  );
}

const TILE_HEIGHT = 64;

const styles = StyleSheet.create({
  columns: { flexDirection: "row", gap: SPACE },
  column: { flex: 1, gap: SPACE / 2 },
  tile: { height: TILE_HEIGHT, borderRadius: RADIUS, justifyContent: "center", padding: 8 },
  tileText: { fontSize: 17, textAlign: "center" },
  gone: { height: TILE_HEIGHT },
});
