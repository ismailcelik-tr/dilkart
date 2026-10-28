import { router } from "expo-router";
import { useCallback } from "react";
import { Appearance, useColorScheme } from "react-native";

import { useFailedCount, useLoad, useSettings } from "@/services/library";
import { rememberScheme, type Scheme } from "@/services/prefs";
import { ErrorText, Group, Row, Screen, SwitchRow } from "@/ui/components";

import { FIELDS, labelOf, type Field } from "./choices";

const STUDY: Field[] = ["newPerDay", "reviewsPerDay", "dayStartHour", "dailyGoal"];

export function SettingsScreen() {
  const settings = useSettings();
  const failedCount = useFailedCount();
  const [data] = useLoad(
    useCallback(async () => ({ values: await settings.get(), failed: await failedCount() }), [settings, failedCount]),
  );
  const dark = useColorScheme() === "dark";
  if (data === undefined) {
    return null;
  }

  const row = (field: Field) => (
    <Row
      key={field}
      title={FIELDS[field].title}
      subtitle={labelOf(field, data.values[field])}
      onPress={() => router.push({ pathname: "/settings/choose", params: { field } })}
    />
  );

  return (
    <Screen>
      <Group title="Çalışma">{STUDY.map((f) => row(f))}</Group>
      <Group title="Ses">{row("accent")}</Group>
      <Group title="Görünüm">
        <SwitchRow icon="moon.fill" title="Koyu görünüm" value={dark} onChange={(on) => setScheme(on ? "dark" : "light")} />
      </Group>
      {data.failed > 0 && <ErrorText text={`Gönderilemeyen değişiklik: ${data.failed}`} />}
    </Screen>
  );
}

/** App-wide, native header and keyboard included. */
function setScheme(scheme: Scheme) {
  Appearance.setColorScheme(scheme);
  void rememberScheme(scheme);
}
