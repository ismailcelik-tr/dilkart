import { Direction, lookup, type Deck, type Recent, type Result, type Sense } from "@dilkart/core";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useDictionary, useLibrary } from "@/services/library";
import { lastDirection, rememberDeck, rememberDirection } from "@/services/prefs";
import { targetDeck } from "@/services/targetDeck";
import { Button, Empty, Group, Row, Screen } from "@/ui/components";
import { RADIUS, SPACE, useTheme } from "@/ui/theme";

const DIRECTIONS: Record<Direction, string> = {
  [Direction.EnTr]: "EN→TR",
  [Direction.TrEn]: "TR→EN",
  [Direction.EnEn]: "EN→EN",
};
const RESULT_LIMIT = 10;
const TYPING_PAUSE_MS = 150;
const MAX_EXAMPLES = 2;

interface Pick {
  result: Result;
  sense: Sense;
}

/** Panel over any screen (formSheet), so a study session underneath keeps its place. */
export function DictionaryScreen() {
  const lib = useLibrary();
  const { dictionary, recent } = useDictionary();
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<Direction>();
  const [results, setResults] = useState<Result[]>([]);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [message, setMessage] = useState<string>();
  const [choosing, setChoosing] = useState<{ pick: Pick; decks: Deck[] }>();

  useEffect(() => {
    lastDirection().then(setDirection);
    recent.list().then(setRecents);
  }, [recent]);

  useEffect(() => {
    // An empty query shows recent searches, so stale results never render.
    if (direction === undefined || query.trim() === "") {
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const reader = await dictionary();
      let found = await lookup(reader, query, direction, { limit: RESULT_LIMIT });
      if (found.length === 0) {
        found = await lookup(reader, query, direction, { prefix: true, limit: RESULT_LIMIT });
      }
      if (live) {
        setResults(found);
      }
    }, TYPING_PAUSE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [dictionary, query, direction]);

  const choose = (d: Direction) => {
    setDirection(d);
    void rememberDirection(d);
  };

  const remember = useCallback(async () => {
    if (direction !== undefined) {
      await recent.add(query, direction);
      setRecents(await recent.list());
    }
  }, [recent, query, direction]);

  const add = async ({ result, sense }: Pick, deck?: Deck) => {
    if (direction === undefined) {
      return;
    }
    const target = deck ?? (await targetDeck(lib));
    const added = await lib.addFromDictionary(target.id, result, sense.id, direction);
    if (added.ok) {
      await rememberDeck(target.id);
      setMessage(`${target.name} destesine eklendi`);
    } else {
      const home = (await lib.decks()).find((d) => d.id === added.duplicateOf.deckId);
      setMessage(`Bu anlam zaten ${home?.name ?? "bir"} destesinde`);
    }
    setChoosing(undefined);
    await remember();
  };

  const pickDeck = async (pick: Pick) => setChoosing({ pick, decks: await lib.decks() });

  if (choosing !== undefined) {
    return (
      <Screen>
        <Empty text={`"${choosing.pick.sense.gloss}" hangi desteye?`} />
        <Group>
          {choosing.decks.map((d) => (
            <Row key={d.id} title={d.name} subtitle={`${d.cardCount} kart`} onPress={() => add(choosing.pick, d)} />
          ))}
        </Group>
        <Button title="Vazgeç" onPress={() => setChoosing(undefined)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <TextInput
        accessibilityLabel="Sözlükte ara"
        placeholder="Kelime ara"
        placeholderTextColor={theme.secondary}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={remember}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
      />
      <View style={styles.directions}>
        {Object.values(Direction).map((d) => (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityState={{ selected: d === direction }}
            onPress={() => choose(d)}
            style={[styles.direction, { backgroundColor: d === direction ? theme.tint : theme.surface }]}
          >
            <Text style={{ color: d === direction ? "#FFFFFF" : theme.text }}>{DIRECTIONS[d]}</Text>
          </Pressable>
        ))}
      </View>
      {message !== undefined && <Text style={[styles.message, { color: theme.tint }]}>{message}</Text>}

      {query.trim() === "" ? (
        <RecentList
          recents={recents}
          onPick={(r) => {
            setDirection(r.direction);
            setQuery(r.query);
          }}
          onClear={async () => {
            await recent.clear();
            setRecents([]);
          }}
        />
      ) : results.length === 0 ? (
        <Empty text="Sonuç yok" />
      ) : (
        results.map((r) => <Entry key={r.id} result={r} onAdd={(sense) => add({ result: r, sense })} onChoose={(sense) => pickDeck({ result: r, sense })} />)
      )}
    </Screen>
  );
}

function RecentList(props: { recents: Recent[]; onPick: (r: Recent) => void; onClear: () => void }) {
  if (props.recents.length === 0) {
    return <Empty text="Henüz arama yok" />;
  }
  return (
    <>
      <Group>
        {props.recents.map((r) => (
          <Row key={`${r.direction}:${r.query}`} title={r.query} subtitle={DIRECTIONS[r.direction]} onPress={() => props.onPick(r)} />
        ))}
      </Group>
      <Button title="Son aramaları temizle" onPress={props.onClear} />
    </>
  );
}

function Entry(props: { result: Result; onAdd: (s: Sense) => void; onChoose: (s: Sense) => void }) {
  const { result } = props;
  const theme = useTheme();
  return (
    <View style={[styles.entry, { backgroundColor: theme.surface }]}>
      <Text style={[styles.headword, { color: theme.text }]}>
        {result.headword}
        {result.pos && <Text style={{ color: theme.secondary }}> · {result.pos}</Text>}
      </Text>
      {result.senses.map((s) => (
        <View key={s.id} style={styles.sense}>
          <View style={styles.senseText}>
            <Text style={[styles.body, { color: theme.text }]}>{s.gloss}</Text>
            {s.context && <Text style={[styles.caption, { color: theme.secondary }]}>{s.context}</Text>}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Karta ekle: ${s.gloss}`}
            accessibilityHint="Uzun basınca deste seçilir"
            onPress={() => props.onAdd(s)}
            onLongPress={() => props.onChoose(s)}
            hitSlop={8}
            style={[styles.add, { borderColor: theme.tint }]}
          >
            <Text style={[styles.addText, { color: theme.tint }]}>+</Text>
          </Pressable>
        </View>
      ))}
      {result.examples.slice(0, MAX_EXAMPLES).map((e, i) => (
        // Sources can repeat a sentence, so the text alone is not a unique key.
        <Text key={`${i}:${e.en}`} style={[styles.caption, { color: theme.secondary }]}>
          {e.en}
          {e.tr ? ` — ${e.tr}` : ""}
        </Text>
      ))}
      {result.synonyms.length > 0 && (
        <Text style={[styles.caption, { color: theme.secondary }]}>Eş anlamlılar: {result.synonyms.join(", ")}</Text>
      )}
    </View>
  );
}

const ADD_SIZE = 32;

const styles = StyleSheet.create({
  input: { fontSize: 17, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS },
  directions: { flexDirection: "row", gap: SPACE / 2 },
  direction: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: RADIUS },
  message: { fontSize: 15, textAlign: "center" },
  entry: { borderRadius: RADIUS, padding: SPACE, gap: SPACE / 2 },
  headword: { fontSize: 20, fontWeight: "600" },
  sense: { flexDirection: "row", alignItems: "center", gap: SPACE / 2 },
  senseText: { flex: 1 },
  body: { fontSize: 17 },
  caption: { fontSize: 13 },
  add: { width: ADD_SIZE, height: ADD_SIZE, borderRadius: ADD_SIZE / 2, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  addText: { fontSize: 20, lineHeight: 22 },
});
