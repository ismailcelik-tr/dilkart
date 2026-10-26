import type { UserSettings } from "@dilkart/core";
import { Stack } from "expo-router";
import { useCallback } from "react";

import { useLoad, useSettings } from "@/services/library";
import { Group, Row, Screen } from "@/ui/components";
import { goBack } from "@/ui/navigation";

import { FIELDS, type Field } from "./choices";

export function ChooseScreen({ field }: { field: Field }) {
  const settings = useSettings();
  const [values] = useLoad(useCallback(() => settings.get(), [settings]));
  if (values === undefined) {
    return null;
  }

  const pick = async (value: UserSettings[Field]) => {
    await settings.set({ [field]: value } as Partial<UserSettings>);
    goBack("/settings");
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: FIELDS[field].title }} />
      <Group>
        {FIELDS[field].choices.map((c) => (
          <Row key={String(c.value)} title={c.label} selected={c.value === values[field]} onPress={() => pick(c.value)} />
        ))}
      </Group>
    </Screen>
  );
}
