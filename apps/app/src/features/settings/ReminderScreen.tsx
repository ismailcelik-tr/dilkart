import { useCallback, useState } from "react";

import { useLoad, useStats } from "@/services/library";
import { DEFAULT_REMINDER_MINUTE, reminderMinute } from "@/services/prefs";
import { setReminderTime, testReminder } from "@/services/reminders";
import { Button, ButtonKind, Group, Row, Screen } from "@/ui/components";
import { goBack } from "@/ui/navigation";
import { TimePicker } from "@/ui/TimePicker";

import { clock } from "./choices";

const PRESETS = [9, 12, 18, 20, 21, 22].map((h) => h * 60);

export function ReminderScreen() {
  const stats = useStats();
  const [current] = useLoad(useCallback(() => reminderMinute(), []));
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState<number>();
  if (current === undefined) {
    return null;
  }

  const pick = async (value: number | null) => {
    await setReminderTime(stats, value);
    goBack("/settings");
  };
  const isCustom = current !== null && !PRESETS.includes(current);
  const wheel = draft ?? current ?? DEFAULT_REMINDER_MINUTE;

  return (
    <Screen>
      <Group>
        <Row title="Kapalı" selected={current === null} onPress={() => pick(null)} />
        {PRESETS.map((m) => (
          <Row key={m} title={clock(m)} selected={m === current} onPress={() => pick(m)} />
        ))}
        <Row
          title="Özel…"
          subtitle={isCustom ? clock(current) : undefined}
          selected={isCustom}
          onPress={() => setCustom(true)}
        />
      </Group>
      {custom && (
        <>
          <TimePicker value={wheel} onChange={setDraft} />
          <Button title="Kaydet" kind={ButtonKind.Primary} onPress={() => pick(wheel)} />
        </>
      )}
      {__DEV__ && (
        <Group>
          <Row title="Test: 1 dk sonra" onPress={() => void testReminder(stats)} />
        </Group>
      )}
    </Screen>
  );
}
