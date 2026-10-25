import type { Card } from "@dilkart/core";
import { router } from "expo-router";
import type { ReactElement } from "react";

import { ListScreen, Row } from "@/ui/components";

export function CardList(props: {
  cards: Card[];
  empty?: ReactElement;
  footer?: ReactElement;
  onContentSizeChange?: () => void;
}) {
  return (
    <ListScreen
      data={props.cards}
      keyOf={(c) => c.id}
      render={(c) => (
        <Row
          title={c.usageLabel ? `${c.front} · ${c.usageLabel}` : c.front}
          subtitle={c.meanings.map((m) => m.tr).join(", ")}
          onPress={() => router.push(`/card/${c.id}`)}
        />
      )}
      header={props.cards.length === 0 ? props.empty : undefined}
      footer={props.footer}
      onContentSizeChange={props.onContentSizeChange}
    />
  );
}
