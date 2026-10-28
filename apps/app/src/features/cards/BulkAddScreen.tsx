import { CardError, parseBulk, planBulk } from "@dilkart/core";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";

import { useLibrary, useLoad } from "@/services/library";
import { Button, ButtonKind, ErrorText, Screen } from "@/ui/components";
import { goBack } from "@/ui/navigation";
import { RADIUS, SPACE, useTheme } from "@/ui/theme";

const REASONS: Record<CardError, string> = {
  [CardError.EmptyFront]: "önyüz yok",
  [CardError.NoMeaning]: "anlam yok",
};

const HINT =
  "Her satır bir kart: kelime ; anlamlar (virgülle) ; İngilizce örnek ; Türkçe örnek. " +
  "Excel ya da Sheets'ten kopyalanan sütunlar da olur.";

export function BulkAddScreen({ deckId }: { deckId: string }) {
  const lib = useLibrary();
  const theme = useTheme();
  const [text, setText] = useState("");
  const [data] = useLoad(useCallback(async (l) => ({ cards: await l.allCards(), decks: await l.decks() }), []));
  if (data === undefined) {
    return null;
  }

  const plan = planBulk(parseBulk(text), data.cards);
  const deckName = (id: string) => data.decks.find((d) => d.id === id)?.name ?? "başka bir";
  const summary = [
    `${plan.add.length} kart eklenecek`,
    plan.invalid.length > 0 && `${plan.invalid.length} satır hatalı`,
    plan.duplicates.length > 0 && `${plan.duplicates.length} kart zaten var`,
  ]
    .filter(Boolean)
    .join(" · ");
  const caption = [styles.caption, { color: theme.secondary }];

  const add = async () => {
    for (const draft of plan.add) {
      await lib.createCard(deckId, draft);
    }
    goBack(`/deck/${deckId}`);
  };

  return (
    <Screen typing>
      <Text style={caption}>{HINT}</Text>
      <TextInput
        accessibilityLabel="Kartlar"
        placeholder={"ubiquitous; her yerde bulunan; Phones are ubiquitous.; Telefonlar her yerde.\nmitigate; hafifletmek, azaltmak"}
        placeholderTextColor={theme.secondary}
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
      />
      {text.trim() !== "" && <Text style={[styles.summary, { color: theme.text }]}>{summary}</Text>}
      {plan.invalid.map((l) => (
        <ErrorText key={`e${l.line}`} text={`${l.line}. satır: ${l.errors.map((e) => REASONS[e]).join(", ")}`} />
      ))}
      {plan.duplicates.map((d) => (
        <Text key={`d${d.line}`} style={caption}>
          {d.existing !== undefined
            ? `${d.front} · ${deckName(d.existing.deckId)} destesinde`
            : `${d.front} · ${d.sameAsLine}. satırla aynı`}
        </Text>
      ))}
      {plan.add.length > 0 && <Button title={`${plan.add.length} kartı ekle`} kind={ButtonKind.Primary} onPress={add} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 15, minHeight: 200, padding: 12, borderRadius: RADIUS, textAlignVertical: "top" },
  summary: { fontSize: 15, fontWeight: "600", paddingHorizontal: SPACE / 2 },
  caption: { fontSize: 13 },
});
