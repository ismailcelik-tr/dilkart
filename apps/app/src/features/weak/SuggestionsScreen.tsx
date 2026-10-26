import { useCallback, useState } from "react";

import { useLoad, useWeakWords } from "@/services/library";
import { Button, ButtonKind, Empty, Group, Row, Screen } from "@/ui/components";
import { goBack } from "@/ui/navigation";

export function SuggestionsScreen() {
  const weak = useWeakWords();
  const [cards] = useLoad(useCallback(() => weak.suggestions(), [weak]));
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  if (cards === undefined) {
    return null;
  }
  if (cards.length === 0) {
    return <Empty text="Öneri yok" />;
  }

  const toggle = (id: string) => {
    const next = new Set(rejected);
    if (!next.delete(id)) {
      next.add(id);
    }
    setRejected(next);
  };

  const confirm = async () => {
    const accepted = cards.filter((c) => !rejected.has(c.id)).map((c) => c.id);
    await weak.decide(accepted, [...rejected]);
    goBack("/");
  };

  return (
    <Screen>
      <Empty text="Zayıf olmadığını düşündüğün kelimenin işaretini kaldır." />
      <Group>
        {cards.map((c) => (
          <Row
            key={c.id}
            title={c.front}
            subtitle={c.meanings.map((m) => m.tr).join(", ")}
            selected={!rejected.has(c.id)}
            onPress={() => toggle(c.id)}
          />
        ))}
      </Group>
      <Button title="Onayla" kind={ButtonKind.Primary} onPress={confirm} />
    </Screen>
  );
}
