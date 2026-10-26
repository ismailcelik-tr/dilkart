import { MATCH_MIN_CARDS, Module, SessionKind } from "@dilkart/core";
import { router } from "expo-router";
import { useCallback, useState } from "react";

import { lastModule, rememberModule } from "@/services/prefs";
import { useLoad, useStudy, useWeakWords } from "@/services/library";
import { useSpeech } from "@/services/speech";
import { Button, ButtonKind, Empty, ErrorText, Group, Row, Screen } from "@/ui/components";

import { practiceCards } from "./cards";
import { MODULE_NAMES, MODULES } from "./modules";

const NO_VOICE =
  "Cihazda İngilizce ses yok. Ayarlar > Erişilebilirlik > Seslendirilen İçerik > Sesler'den bir İngilizce ses indirin.";

/** `deckId` undefined means every deck. */
export function StudyStartScreen({ deckId, weak = false }: { deckId?: string; weak?: boolean }) {
  const study = useStudy();
  const weakWords = useWeakWords();
  const speech = useSpeech();
  const [picked, setPicked] = useState<Module>();

  const [data] = useLoad(
    useCallback(
      async (lib) => ({
        plan: weak ? undefined : await study.plan(deckId),
        saved: await lastModule(),
        cardCount: (await practiceCards(lib, weakWords, weak ? SessionKind.Weak : SessionKind.Free, deckId)).length,
      }),
      [study, weakWords, deckId, weak],
    ),
  );
  if (data === undefined) {
    return null;
  }

  const module = picked ?? data.saved ?? Module.Recall;
  const blocked: Partial<Record<Module, string>> = {};
  if (speech.available === false) {
    blocked[Module.Listening] = NO_VOICE;
  }
  if (data.cardCount < MATCH_MIN_CARDS) {
    blocked[Module.Match] = `Eşleştirme için en az ${MATCH_MIN_CARDS} kart gerekli.`;
  }

  const choose = (m: Module) => {
    if (blocked[m] === undefined) {
      setPicked(m);
      void rememberModule(m);
    }
  };

  const go = (kind: SessionKind) => {
    const params = { ...(deckId === undefined ? {} : { deckId }), module: String(module), kind };
    if (module === Module.Match) {
      router.push({ pathname: "/study/match", params });
    } else {
      router.push({ pathname: "/study/session", params });
    }
  };

  const { plan } = data;
  const summary =
    plan === undefined
      ? `Zayıf ${data.cardCount}`
      : `Yeni ${plan.counts.new} · Tekrar ${plan.counts.review} · Öğrenme ${plan.counts.learning}`;

  const start = () => {
    if (plan === undefined) {
      return data.cardCount === 0 ? (
        <Empty text="Zayıf kelime yok" />
      ) : (
        <Button title="Başla" kind={ButtonKind.Primary} onPress={() => go(SessionKind.Weak)} />
      );
    }
    if (plan.cards.length === 0 && module !== Module.Match) {
      return (
        <>
          <Empty text="Bugünlük bitti" />
          <Button title="Serbest çalış" kind={ButtonKind.Primary} onPress={() => go(SessionKind.Free)} />
        </>
      );
    }
    return <Button title="Başla" kind={ButtonKind.Primary} onPress={() => go(SessionKind.Review)} />;
  };

  return (
    <Screen>
      <Empty text={summary} />
      <Group>
        {MODULES.map((m) => (
          <Row
            key={m}
            title={MODULE_NAMES[m]}
            selected={m === module}
            subtitle={blocked[m] === undefined ? undefined : "Kullanılamıyor"}
            onPress={() => choose(m)}
          />
        ))}
      </Group>
      {Object.values(blocked).map((reason) => (
        <ErrorText key={reason} text={reason} />
      ))}
      {start()}
    </Screen>
  );
}
