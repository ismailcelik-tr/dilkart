import type { Card } from "@dilkart/core";
import { router } from "expo-router";
import type { ReactElement } from "react";

import { ListenButton } from "@/features/speech/ListenButton";
import { useSpeech } from "@/services/speech";
import { ListScreen, Row } from "@/ui/components";

export function CardList(props: {
  cards: Card[];
  empty?: ReactElement;
  header?: ReactElement;
  footer?: ReactElement;
  onContentSizeChange?: () => void;
}) {
  const speech = useSpeech();
  const empty = props.cards.length === 0 ? props.empty : undefined;
  return (
    <ListScreen
      data={props.cards}
      keyOf={(c) => c.id}
      render={(c) => (
        <Row
          title={c.usageLabel ? `${c.front} · ${c.usageLabel}` : c.front}
          subtitle={c.meanings.map((m) => m.tr).join(", ")}
          onPress={() => router.push(`/card/${c.id}`)}
          accessory={speech.available ? <ListenButton text={c.front} onSpeak={speech.speak} /> : undefined}
        />
      )}
      header={
        props.header || empty ? (
          <>
            {props.header}
            {empty}
          </>
        ) : undefined
      }
      footer={props.footer}
      onContentSizeChange={props.onContentSizeChange}
    />
  );
}
