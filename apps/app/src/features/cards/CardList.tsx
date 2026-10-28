import type { Card } from "@dilkart/core";
import { router } from "expo-router";
import type { ReactElement } from "react";

import { ListenButton } from "@/features/speech/ListenButton";
import { useSpeech } from "@/services/speech";
import { ListScreen, Row, SwipeToDelete } from "@/ui/components";

export function CardList(props: {
  cards: Card[];
  empty?: ReactElement;
  header?: ReactElement;
  footer?: ReactElement;
  onContentSizeChange?: () => void;
  /** Adds a swipe-to-delete action to each row. */
  onDelete?: (card: Card) => void;
}) {
  const speech = useSpeech();
  const empty = props.cards.length === 0 ? props.empty : undefined;
  return (
    <ListScreen
      data={props.cards}
      keyOf={(c) => c.id}
      render={(c) => {
        const row = (
          <Row
            title={c.usageLabel ? `${c.front} · ${c.usageLabel}` : c.front}
            subtitle={c.meanings.map((m) => m.tr).join(", ")}
            onPress={() => router.push(`/card/${c.id}`)}
            accessory={speech.available ? <ListenButton text={c.front} onSpeak={speech.speak} /> : undefined}
          />
        );
        const { onDelete } = props;
        if (onDelete === undefined) {
          return row;
        }
        return (
          <SwipeToDelete label={`Sil: ${c.front}`} onDelete={() => onDelete(c)}>
            {row}
          </SwipeToDelete>
        );
      }}
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
