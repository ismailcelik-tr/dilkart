import { CardError, type CardDraft } from "@dilkart/core";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { useLibrary } from "@/services/library";
import { rememberDeck } from "@/services/prefs";
import { Button, ButtonKind, ErrorText, Field, Screen } from "@/ui/components";
import { goBack } from "@/ui/navigation";

const MESSAGES: Record<CardError, string> = {
  [CardError.EmptyFront]: "Ön yüz boş olamaz.",
  [CardError.NoMeaning]: "En az bir anlam girin.",
};

const EMPTY: CardDraft = { front: "", meanings: [{ tr: "" }] };

/** New card in `deckId`, or edits `cardId`. */
export function CardFormScreen({ cardId, deckId }: { cardId?: string; deckId?: string }) {
  const lib = useLibrary();
  const [draft, setDraft] = useState<CardDraft>(EMPTY);
  const [home, setHome] = useState(deckId);
  const [errors, setErrors] = useState<CardError[]>([]);

  useEffect(() => {
    if (cardId === undefined) {
      return;
    }
    lib.card(cardId).then((card) => {
      if (card !== undefined) {
        setDraft(card);
        setHome(card.deckId);
      }
    });
  }, [lib, cardId]);

  const set = (patch: Partial<CardDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setMeaning = (i: number, tr: string) =>
    set({ meanings: draft.meanings.map((m, j) => (j === i ? { ...m, tr } : m)) });

  const back = () => goBack(home === undefined ? "/" : `/deck/${home}`);

  const save = async () => {
    const result =
      cardId === undefined ? await lib.createCard(String(deckId), draft) : await lib.updateCard(cardId, draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    if (home !== undefined) {
      await rememberDeck(home);
    }
    back();
  };

  const remove = () =>
    Alert.alert("Kartı sil", `${draft.front} silinecek.`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await lib.removeCard(String(cardId));
          back();
        },
      },
    ]);

  const has = (e: CardError) => (errors.includes(e) ? MESSAGES[e] : undefined);

  return (
    <Screen>
      <Field label="Ön yüz" value={draft.front} onChangeText={(front) => set({ front })} error={has(CardError.EmptyFront)} />
      {draft.meanings.map((m, i) => (
        <Field key={i} label={`Anlam ${i + 1}`} value={m.tr} onChangeText={(tr) => setMeaning(i, tr)} />
      ))}
      {has(CardError.NoMeaning) !== undefined && <ErrorText text={MESSAGES[CardError.NoMeaning]} />}
      <Button title="Anlam ekle" onPress={() => set({ meanings: [...draft.meanings, { tr: "" }] })} />
      <Field label="Kullanım etiketi" value={draft.usageLabel ?? ""} onChangeText={(usageLabel) => set({ usageLabel })} />
      <Field label="Örnek cümle (İngilizce)" value={draft.exampleEn ?? ""} onChangeText={(exampleEn) => set({ exampleEn })} />
      <Field label="Örnek cümle (Türkçe)" value={draft.exampleTr ?? ""} onChangeText={(exampleTr) => set({ exampleTr })} />
      <Button title="Kaydet" kind={ButtonKind.Primary} onPress={save} />
      {cardId !== undefined && (
        <>
          <Button title="Taşı" onPress={() => router.push(`/card/${cardId}/move`)} />
          <Button title="Kartı sil" kind={ButtonKind.Danger} onPress={remove} />
        </>
      )}
    </Screen>
  );
}
