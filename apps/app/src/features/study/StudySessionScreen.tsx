import { checkAnswer, gradeFor, Module, Session, SessionKind, type Card, type Rating, type Verdict } from "@dilkart/core";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ListenButton } from "@/features/speech/ListenButton";
import { useLibrary, useStudy, useWeakWords } from "@/services/library";
import { useSpeech } from "@/services/speech";
import { Button, ButtonKind, Empty, Screen } from "@/ui/components";
import { intervalLabel } from "@/ui/format";
import { RADIUS, SPACE, useTheme } from "@/ui/theme";

import { practiceCards } from "./cards";
import { RATING_NAMES, RATINGS } from "./modules";

const VERDICT_NAMES: Record<Verdict, string> = {
  correct: "Doğru",
  almost: "Neredeyse doğru",
  wrong: "Yanlış",
};

function shuffle<T>(items: T[]): T[] {
  return items
    .map((item) => ({ item, key: Math.random() }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item);
}

const meaningsOf = (c: Card) => c.meanings.map((m) => m.tr).join(", ");

type SessionView = { session: Session; card: Card | undefined; done: number; left: number };

const snapshot = (session: Session): SessionView => ({ session, card: session.current(), ...session.progress() });

export function StudySessionScreen(props: { deckId?: string; module: Module; kind: SessionKind }) {
  const { deckId, module, kind } = props;
  const study = useStudy();
  const lib = useLibrary();
  const weak = useWeakWords();
  // Session mutates in place; React Compiler memoizes by reference, so render from a fresh snapshot.
  const [view, setView] = useState<SessionView>();

  useEffect(() => {
    (async () => {
      const cards =
        kind === SessionKind.Review
          ? (await study.plan(deckId)).cards
          : shuffle(await practiceCards(lib, weak, kind, deckId));
      setView(snapshot(new Session(cards, study, { session: kind, module })));
    })();
  }, [study, lib, weak, deckId, module, kind]);

  if (view === undefined) {
    return null;
  }

  const { session, card, done, left } = view;
  if (card === undefined) {
    return (
      <Screen>
        <Empty text="Oturum bitti" />
        <Empty text={`${done} cevap`} />
        <Button title="Destelere dön" kind={ButtonKind.Primary} onPress={() => router.dismissTo("/")} />
      </Screen>
    );
  }

  const rate = async (rating: Rating) => {
    await session.answer(rating);
    setView(snapshot(session));
  };
  const key = `${card.id}:${done}`;

  return (
    <Screen typing={module === Module.Typing || module === Module.Listening}>
      <Empty text={`${done} / ${done + left}`} />
      {module === Module.Typing || module === Module.Listening ? (
        <TypedCard key={key} card={card} listen={module === Module.Listening} onRate={rate} />
      ) : (
        <RecallCard
          key={key}
          card={card}
          reverse={module === Module.Reverse}
          intervals={kind === SessionKind.Review ? study.intervals(card) : undefined}
          onRate={rate}
        />
      )}
    </Screen>
  );
}

function Face({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.face, { backgroundColor: theme.surface }]}>{children}</View>;
}

function Big({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[styles.big, { color: theme.text }]}>{text}</Text>;
}

function Small({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[styles.small, { color: theme.secondary }]}>{text}</Text>;
}

function RecallCard(props: { card: Card; reverse: boolean; intervals?: Record<Rating, number>; onRate: (r: Rating) => void }) {
  const { card, reverse, intervals, onRate } = props;
  const speech = useSpeech();
  const [shown, setShown] = useState(false);

  const english = (
    <>
      <Big text={card.front} />
      {speech.available && <Button title="Dinle" onPress={() => speech.speak(card.front)} />}
    </>
  );
  const turkish = (
    <>
      <Big text={meaningsOf(card)} />
      {card.usageLabel && <Small text={card.usageLabel} />}
    </>
  );

  return (
    <>
      <Face>{reverse ? turkish : english}</Face>
      {!shown ? (
        <Button title="Cevabı göster" kind={ButtonKind.Primary} onPress={() => setShown(true)} />
      ) : (
        <>
          <Face>
            {reverse ? english : turkish}
            {card.exampleEn && (
              <View style={styles.example}>
                <View style={styles.exampleText}>
                  <Small text={card.exampleEn} />
                </View>
                {speech.available && <ListenButton text={card.exampleEn} onSpeak={speech.speak} />}
              </View>
            )}
            {card.exampleTr && <Small text={card.exampleTr} />}
          </Face>
          <View style={styles.ratings}>
            {RATINGS.map((r) => (
              <View key={r} style={styles.rating}>
                <Button title={RATING_NAMES[r]} onPress={() => onRate(r)} />
                {intervals && <Small text={intervalLabel(intervals[r])} />}
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}

function TypedCard(props: { card: Card; listen: boolean; onRate: (r: Rating) => void }) {
  const { card, listen, onRate } = props;
  const theme = useTheme();
  const speech = useSpeech();
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<ReturnType<typeof checkAnswer>>();

  useEffect(() => {
    if (listen && speech.available) {
      speech.speak(card.front);
    }
    // Speak once when the voice list is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listen, speech.available, card.front]);

  return (
    <>
      <Face>
        {listen ? (
          <Button title="Tekrar dinle" onPress={() => speech.speak(card.front)} />
        ) : (
          <>
            <Big text={meaningsOf(card)} />
            {card.usageLabel && <Small text={card.usageLabel} />}
          </>
        )}
      </Face>
      <TextInput
        accessibilityLabel="Cevabın"
        placeholder="İngilizcesini yaz"
        placeholderTextColor={theme.secondary}
        value={typed}
        onChangeText={setTyped}
        editable={result === undefined}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
      />
      {result === undefined ? (
        <Button title="Kontrol et" kind={ButtonKind.Primary} onPress={() => setResult(checkAnswer(typed, [card.front]))} />
      ) : (
        <>
          <Face>
            <Big text={VERDICT_NAMES[result.verdict]} />
            <Small text={result.expected} />
            {listen && <Small text={meaningsOf(card)} />}
          </Face>
          <Button title="Devam" kind={ButtonKind.Primary} onPress={() => onRate(gradeFor(result.verdict))} />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  face: { borderRadius: RADIUS, padding: SPACE * 1.5, gap: SPACE / 2, alignItems: "center" },
  big: { fontSize: 28, fontWeight: "600", textAlign: "center" },
  small: { fontSize: 15, textAlign: "center" },
  example: { flexDirection: "row", alignItems: "center", gap: SPACE / 2 },
  exampleText: { flexShrink: 1 },
  ratings: { flexDirection: "row", justifyContent: "space-between" },
  rating: { flex: 1, alignItems: "center" },
  input: { fontSize: 22, padding: 12, borderRadius: RADIUS, textAlign: "center" },
});
