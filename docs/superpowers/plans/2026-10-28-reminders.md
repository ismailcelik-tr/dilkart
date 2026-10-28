# Hatırlatma bildirimi: uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gün içinde çalışılmadıysa seçilen saatte yerel bildirim; seri sürüyorsa onu hatırlatan metin.

**Architecture:** Core'da saf `reminderPlan` (kurallar + metin) ve `Stats.reminders(hour)`. App'te `drivers/notifications.ts` (`expo-notifications` yalnız burada), `services/reminders.ts` (sıralı yeniden planlama, izin), saat `prefs`'te. Tetikleyiciler: `LibraryProvider`'da veri açılışı + `AppState` (`active`, `background`), ana sayfa (izin), Ayarlar seçimi.

**Tech Stack:** TypeScript, Vitest, Expo (expo-notifications), Expo Router + jest-expo + RNTL.

Spec: `docs/superpowers/specs/2026-10-28-reminders-design.md`

## Global Constraints

- Yalnız yerel bildirim; sunucu push yok. Saat cihaza özel (`prefs`), sync yok.
- Seçenekler `Kapalı · 09:00 · 12:00 · 18:00 · 20:00 · 21:00 · 22:00`, varsayılan 20:00.
- 7 çalışma günü; gün `k`'nin anı `dayStart(k) + (saat − dayStartHour)`. Bugün ≥1 cevap varsa ya da an geçtiyse bugün yok.
- Metinler spec'teki tablodan birebir.
- İzin yalnız `undetermined` iken istenir; reddedilmişse Ayarlar "Kapalı · iOS Ayarları'ndan izin ver".
- Hatırlatma hatası uygulamayı bozmaz (yutulur, `console.warn`).
- Ekran → `services` → core/driver. Kod/yorum/commit İngilizce, arayüz Türkçe. Önce başarısız test.
- Commit yalnız kullanıcı cihazda "çalışıyor" dedikten sonra (Task 4).
- Komutlar repo kökünden: `~/Desktop/dilkart`.

## Dosya haritası

| Dosya | Sorumluluk |
|---|---|
| `packages/core/src/stats/reminders.ts` (yeni) | `reminderPlan`, `REMINDER_DAYS`, `Reminder`, `ReminderInput` |
| `packages/core/src/data/stats.ts` | `Stats.reminders(hour)` |
| `apps/app/src/drivers/notifications.ts` (yeni) | `expo-notifications` sarmalayıcı |
| `apps/app/test/fakeNotifications.ts` (yeni) | testlerde bellek içi driver |
| `apps/app/src/services/prefs.ts` | `reminderHour`, `rememberReminderHour` |
| `apps/app/src/services/reminders.ts` (yeni) | `refreshReminders`, `askReminders`, `reminderStatus`, `setReminderHour`, `testReminder` |
| `apps/app/src/services/library.tsx` | veri açılışı + `AppState` tetikleyicisi |
| `apps/app/src/features/decks/DeckListScreen.tsx` | ilk yüklemede izin |
| `apps/app/src/features/settings/ReminderScreen.tsx` (yeni), `SettingsScreen.tsx`, `choices.ts` | Ayarlar |
| `apps/app/src/app/settings/reminder.tsx` (yeni), `_layout.tsx` | rota |

Not (spec'ten sapma):
- Spec `Stats.due()` diyor. Servisin `today`, tahmin ve ayarları ayrı ayrı toplamaması için `Stats.reminders(hour)` tek çağrıda `reminderPlan` sonucunu döner; tahmin `report().forecast` ile aynı `forecast` fonksiyonundan gelir.
- Spec driver'da `cancelAll` / `scheduledCount` diyor. Bildirimler kimlikle kurulur (`reminder-0…6`, test için `reminder-test`) ve yalnız bu 7 kimlik iptal edilir; böylece arka plana geçişteki yenileme geliştirme test bildirimini silmez. Sayım testlerde sahte driver'dan okunur.

---

### Task 1: Core `reminderPlan` ve `Stats.reminders`

**Files:**
- Create `packages/core/src/stats/reminders.ts`, `packages/core/src/stats/reminders.test.ts`
- Modify `packages/core/src/data/stats.ts`, `packages/core/src/data/stats.test.ts`
- Modify `packages/core/src/index.ts`

**Interfaces:**
- Produces `REMINDER_DAYS = 7`, `interface Reminder { at: Date; title: string; body: string }`, `interface ReminderInput { now: number; hour: number; dayStartHour: number; tzOffsetMin: number; studied: boolean; streak: number; due: number[] }`, `reminderPlan(input: ReminderInput): Reminder[]`.
- Produces `Stats.reminders(hour: number): Promise<Reminder[]>`.
- Core export: `reminderPlan`, `REMINDER_DAYS`, tipler `Reminder`, `ReminderInput`.

- [ ] **Step 1: Failing tests** — `packages/core/src/stats/reminders.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { reminderPlan, type ReminderInput } from "./reminders";

const DAY = 86_400_000;
const TONIGHT = Date.parse("2026-10-27T17:00:00Z"); // 20:00 Istanbul

const base: ReminderInput = {
  now: Date.parse("2026-10-27T09:00:00Z"), // 12:00 Istanbul
  hour: 20,
  dayStartHour: 4,
  tzOffsetMin: 180,
  studied: false,
  streak: 0,
  due: [0, 0, 0, 0, 0, 0, 0],
};

describe("reminderPlan", () => {
  it("plans seven evenings from today", () => {
    expect(reminderPlan(base).map((r) => r.at.getTime())).toEqual([0, 1, 2, 3, 4, 5, 6].map((d) => TONIGHT + d * DAY));
  });

  it("skips today after study or once the hour passed", () => {
    expect(reminderPlan({ ...base, studied: true })[0]?.at.getTime()).toBe(TONIGHT + DAY);
    expect(reminderPlan({ ...base, now: TONIGHT })).toHaveLength(6);
  });

  it("starts tonight at 03:30, still yesterday's study day", () => {
    const early = { ...base, now: Date.parse("2026-10-27T00:30:00Z"), streak: 3 };
    const [first] = reminderPlan(early);
    expect(first?.at.getTime()).toBe(TONIGHT);
    expect(first?.title).toBe("Çalışma zamanı");
    expect(reminderPlan({ ...early, studied: true })[0]?.title).toBe("🔥 3 günlük serin bitmesin");
  });

  it("names the streak only on days it can still be saved", () => {
    const open = reminderPlan({ ...base, streak: 5 });
    expect(open[0]?.title).toBe("🔥 5 günlük serin bitmesin");
    expect(open[1]?.title).toBe("Çalışma zamanı");

    const done = reminderPlan({ ...base, streak: 5, studied: true });
    expect(done[0]?.title).toBe("🔥 5 günlük serin bitmesin");
    expect(done[1]?.title).toBe("Çalışma zamanı");
  });

  it("counts cards waiting up to that day", () => {
    expect(reminderPlan({ ...base, due: [3, 0, 2, 0, 0, 0, 1] }).map((r) => r.body)).toEqual([
      "Bugün 3 kart seni bekliyor",
      "Bugün 3 kart seni bekliyor",
      "Bugün 5 kart seni bekliyor",
      "Bugün 5 kart seni bekliyor",
      "Bugün 5 kart seni bekliyor",
      "Bugün 5 kart seni bekliyor",
      "Bugün 6 kart seni bekliyor",
    ]);
  });

  it("encourages when nothing is due", () => {
    const plan = reminderPlan({ ...base, streak: 2 });
    expect(plan[0]?.body).toBe("Birkaç kart çalış, seri sürsün");
    expect(plan[1]?.body).toBe("Yeni bir seri başlat");
  });
});
```

  `packages/core/src/data/stats.test.ts` sonuna:

```ts
describe("Stats.reminders", () => {
  it("skips today after study and counts due cards", async () => {
    const go = await card("go");
    await answer(go, HOUR);
    await store.cacheFsrs(go, mature(NOW + DAY));

    const plan = await stats.reminders(20);
    expect(plan).toHaveLength(6);
    expect(plan[0]).toEqual({
      at: new Date("2026-10-28T17:00:00Z"),
      title: "🔥 1 günlük serin bitmesin",
      body: "Bugün 1 kart seni bekliyor",
    });
  });
});
```

- [ ] **Step 2: Fails** — `pnpm --filter @dilkart/core exec vitest run src/stats/reminders src/data/stats` → FAIL (`./reminders` yok; `stats.reminders` yok).

- [ ] **Step 3: Implementation** — `packages/core/src/stats/reminders.ts`:

```ts
// Daily study reminders; docs/superpowers/specs/2026-10-28-reminders-design.md.
import { dayKey, dayStart } from "../fsrs/day";

export const REMINDER_DAYS = 7;
const MS_PER_HOUR = 3_600_000;

export interface Reminder {
  at: Date;
  title: string;
  body: string;
}

export interface ReminderInput {
  now: number;
  /** Local hour, not before dayStartHour. */
  hour: number;
  dayStartHour: number;
  tzOffsetMin: number;
  /** Today has an answer. */
  studied: boolean;
  streak: number;
  /** Due cards per day from today. */
  due: number[];
}

/** One reminder per study day from today; each assumes no study until it fires. */
export function reminderPlan(input: ReminderInput): Reminder[] {
  const { now, hour, dayStartHour, tzOffsetMin, studied, streak, due } = input;
  const today = dayKey(new Date(now), dayStartHour, tzOffsetMin);
  const reminders: Reminder[] = [];
  let waiting = 0;

  for (let d = 0; d < REMINDER_DAYS; d++) {
    waiting += due[d] ?? 0;
    const at = new Date(dayStart(today + d, dayStartHour, tzOffsetMin).getTime() + (hour - dayStartHour) * MS_PER_HOUR);
    if (d === 0 && (studied || at.getTime() <= now)) {
      continue;
    }

    const alive = streak > 0 && (d === 0 || (d === 1 && studied));
    reminders.push({ at, ...text(alive, streak, waiting) });
  }
  return reminders;
}

function text(alive: boolean, streak: number, waiting: number): { title: string; body: string } {
  const title = alive ? `🔥 ${streak} günlük serin bitmesin` : "Çalışma zamanı";
  if (waiting > 0) {
    return { title, body: `Bugün ${waiting} kart seni bekliyor` };
  }
  return { title, body: alive ? "Birkaç kart çalış, seri sürsün" : "Yeni bir seri başlat" };
}
```

  `data/stats.ts`: importlara `import { reminderPlan, type Reminder } from "../stats/reminders";`; `report()`'un altına:

```ts
  /** Next week's reminders at local `hour`. */
  async reminders(hour: number): Promise<Reminder[]> {
    const { dayStartHour } = await this.settings.get();
    const tzOffsetMin = this.tzOffsetMin();
    const now = this.now();
    const { streak, answers } = await this.today();
    const states = (await this.library.allCards()).map((c) => c.fsrs);
    const due = forecast(states, new Date(now).toISOString(), { dayStartHour, tzOffsetMin });
    return reminderPlan({ now, hour, dayStartHour, tzOffsetMin, studied: answers > 0, streak, due });
  }
```

  `index.ts`, `stats/stats` export satırlarının altına:

```ts
export { REMINDER_DAYS, reminderPlan } from "./stats/reminders";
export type { Reminder, ReminderInput } from "./stats/reminders";
```

- [ ] **Step 4: Passes** — `pnpm --filter @dilkart/core exec vitest run` → PASS; `pnpm --filter @dilkart/core typecheck` → temiz.

---

### Task 2: Driver, servis ve tetikleyiciler

**Files:**
- `apps/app/package.json`, `pnpm-lock.yaml` (`expo-notifications`), `apps/app/app.json` (`plugins`)
- Create `apps/app/src/drivers/notifications.ts`, `apps/app/test/fakeNotifications.ts`, `apps/app/src/services/reminders.ts`, `apps/app/test/reminders.test.tsx`
- Modify `apps/app/test/setup.ts`, `apps/app/src/services/prefs.ts`, `apps/app/src/services/library.tsx`, `apps/app/src/features/decks/DeckListScreen.tsx`

**Interfaces:**
- Consumes `Stats.reminders`, `REMINDER_DAYS` (Task 1).
- Produces driver: `enum Permission { Granted = "granted", Denied = "denied", Undetermined = "undetermined" }`, `permission(): Promise<Permission>`, `requestPermission(): Promise<Permission>`, `schedule(id: string, at: Date, title: string, body: string): Promise<void>`, `cancel(ids: string[]): Promise<void>`.
- Produces prefs: `DEFAULT_REMINDER_HOUR = 20`, `reminderHour(): Promise<number | null>`, `rememberReminderHour(hour: number | null): Promise<void>`.
- Produces servis: `refreshReminders(stats)`, `askReminders(stats)`, `reminderStatus(): Promise<ReminderStatus>` (`{ hour: number | null; blocked: boolean }`), `setReminderHour(stats, hour | null)`, `testReminder(stats)`; hepsi `Promise<void>` (status hariç), sıralı, hata fırlatmaz.
- Test: `fake` (`permission`, `asked`, `scheduled: Map<string, { at; title; body }>`), `resetFake()`.

- [ ] **Step 1: Bağımlılık** — `cd apps/app && npx expo install expo-notifications && cd ../..`. `app.json` `plugins` sonuna `"expo-notifications"` (`"expo-sqlite"`'tan sonra).

- [ ] **Step 2: Sahte driver ve başarısız test**
  - `apps/app/test/fakeNotifications.ts`:

```ts
// In-memory drivers/notifications; tests read and set `fake`.
export enum Permission {
  Granted = "granted",
  Denied = "denied",
  Undetermined = "undetermined",
}

interface Scheduled {
  at: Date;
  title: string;
  body: string;
}

export const fake = { permission: Permission.Undetermined, asked: 0, scheduled: new Map<string, Scheduled>() };

export function resetFake() {
  fake.permission = Permission.Undetermined;
  fake.asked = 0;
  fake.scheduled.clear();
}

export const permission = async () => fake.permission;

export async function requestPermission() {
  fake.asked++;
  fake.permission = Permission.Granted;
  return fake.permission;
}

export async function schedule(id: string, at: Date, title: string, body: string) {
  fake.scheduled.set(id, { at, title, body });
}

export async function cancel(ids: string[]) {
  for (const id of ids) {
    fake.scheduled.delete(id);
  }
}
```

  - `test/setup.ts` sonuna:

```ts
// Notifications need native code; tests use an in-memory driver.
jest.mock("@/drivers/notifications", () => jest.requireActual("./fakeNotifications"));

beforeEach(() => resetFake());
```

    ve dosya başına (gesture importunun altına) `import { resetFake } from "./fakeNotifications";`.
  - `apps/app/test/reminders.test.tsx`:

```tsx
import { renderRouter, screen, waitFor } from "expo-router/testing-library";

import { openData } from "@/services/openData";
import { refreshReminders } from "@/services/reminders";

import { fake, Permission } from "./fakeNotifications";
import { testData } from "./testData";

jest.mock("@/services/openData", () => ({ openData: jest.fn() }));

const APP = "./src/app";
const MIN_PLANNED = 6;
let data: Awaited<ReturnType<typeof testData>>;

beforeEach(async () => {
  data = await testData();
  jest.mocked(openData).mockResolvedValue(data);
});

describe("reminders", () => {
  it("asks once on the home screen and plans the week", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    await waitFor(() => expect(fake.scheduled.size).toBeGreaterThanOrEqual(MIN_PLANNED));
    expect(fake.asked).toBe(1);
    expect([...fake.scheduled.values()].every((r) => r.at.getHours() === 20)).toBe(true);
  });

  it("does not ask again once denied and plans nothing", async () => {
    fake.permission = Permission.Denied;
    await renderRouter(APP, { initialUrl: "/" });
    await screen.findByText("Henüz deste yok");
    await refreshReminders(data.stats); // queued after the home screen's ask
    expect(fake.asked).toBe(0);
    expect(fake.scheduled.size).toBe(0);
  });
});
```

- [ ] **Step 3: Fails** — `pnpm --filter @dilkart/app exec jest test/reminders.test.tsx` → FAIL (`@/services/reminders` yok).

- [ ] **Step 4: Implementation**
  - `apps/app/src/drivers/notifications.ts`:

```ts
// Local notifications only; no push.
import * as Notifications from "expo-notifications";

export enum Permission {
  Granted = "granted",
  Denied = "denied",
  Undetermined = "undetermined",
}

const toPermission = (status: string) => Object.values(Permission).find((p) => p === status) ?? Permission.Undetermined;

export async function permission(): Promise<Permission> {
  return toPermission((await Notifications.getPermissionsAsync()).status);
}

export async function requestPermission(): Promise<Permission> {
  return toPermission((await Notifications.requestPermissionsAsync()).status);
}

/** Replaces any notification with the same id. */
export async function schedule(id: string, at: Date, title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

export async function cancel(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}
```

  - `prefs.ts`: anahtarların altına `const REMINDER_KEY = "reminder.hour";` ve `const REMINDER_OFF = "off";`; sona:

```ts
export const DEFAULT_REMINDER_HOUR = 20;

/** Local hour; unset = 20:00, null = off. */
export async function reminderHour(): Promise<number | null> {
  const value = await Storage.getItem(REMINDER_KEY);
  if (value === REMINDER_OFF) {
    return null;
  }
  return value === null ? DEFAULT_REMINDER_HOUR : Number(value);
}

export async function rememberReminderHour(hour: number | null): Promise<void> {
  await Storage.setItem(REMINDER_KEY, hour === null ? REMINDER_OFF : String(hour));
}
```

  - `apps/app/src/services/reminders.ts`:

```ts
// Daily study reminders; docs/superpowers/specs/2026-10-28-reminders-design.md.
import { REMINDER_DAYS, type Stats } from "@dilkart/core";

import { cancel, permission, Permission, requestPermission, schedule } from "@/drivers/notifications";

import { DEFAULT_REMINDER_HOUR, rememberReminderHour, reminderHour } from "./prefs";

const IDS = Array.from({ length: REMINDER_DAYS }, (_, i) => `reminder-${i}`);
const TEST_ID = "reminder-test";
const TEST_DELAY_MS = 60_000;

export interface ReminderStatus {
  /** null when off. */
  hour: number | null;
  /** iOS permission denied. */
  blocked: boolean;
}

// Triggers overlap (foreground, home load, settings); one at a time keeps ids consistent.
let queue: Promise<void> = Promise.resolve();

/** Runs after earlier reminder work; a failure never reaches the app. */
function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch((e: unknown) => console.warn("reminders", e));
  return queue;
}

async function askIfUnasked() {
  if ((await permission()) === Permission.Undetermined) {
    await requestPermission();
  }
}

async function plan(stats: Stats) {
  await cancel(IDS);
  const hour = await reminderHour();
  if (hour === null || (await permission()) !== Permission.Granted) {
    return;
  }
  for (const [i, r] of (await stats.reminders(hour)).entries()) {
    await schedule(`reminder-${i}`, r.at, r.title, r.body);
  }
}

/** Replaces the scheduled reminders with the next week's. */
export const refreshReminders = (stats: Stats) => enqueue(() => plan(stats));

/** Asks iOS once, while still undetermined, then plans. */
export const askReminders = (stats: Stats) =>
  enqueue(async () => {
    await askIfUnasked();
    await plan(stats);
  });

export const setReminderHour = (stats: Stats, hour: number | null) =>
  enqueue(async () => {
    await rememberReminderHour(hour);
    await plan(stats);
  });

export async function reminderStatus(): Promise<ReminderStatus> {
  return { hour: await reminderHour(), blocked: (await permission()) === Permission.Denied };
}

/** Dev only: the next reminder's text a minute from now. */
export const testReminder = (stats: Stats) =>
  enqueue(async () => {
    await askIfUnasked();
    const [next] = await stats.reminders((await reminderHour()) ?? DEFAULT_REMINDER_HOUR);
    if (next !== undefined) {
      await schedule(TEST_ID, new Date(Date.now() + TEST_DELAY_MS), next.title, next.body);
    }
  });
```

  - `library.tsx`: `react-native` importu `import { AppState } from "react-native";`; `import { refreshReminders } from "./reminders";` (`./openData` importunun altına); `uidOpen` sync effect'inin üstüne:

```ts
  // Today's reminder must go once the user studies; leaving the app is the moment to know.
  useEffect(() => {
    if (data === undefined) {
      return;
    }
    void refreshReminders(data.stats);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" || state === "background") {
        void refreshReminders(data.stats);
      }
    });
    return () => sub.remove();
  }, [data]);
```

  - `DeckListScreen.tsx`: `import { useCallback, useEffect } from "react";`, `import { askReminders } from "@/services/reminders";`; `const stats = useStats();` altına:

```ts
  useEffect(() => {
    void askReminders(stats);
  }, [stats]);
```

- [ ] **Step 5: Passes** — `pnpm --filter @dilkart/app exec jest` → PASS (2 yeni + mevcutlar). `pnpm typecheck` → temiz.

---

### Task 3: Ayarlar'da hatırlatma

**Files:**
- Create `apps/app/src/features/settings/ReminderScreen.tsx`, `apps/app/src/app/settings/reminder.tsx`
- Modify `apps/app/src/features/settings/SettingsScreen.tsx`, `apps/app/src/features/settings/choices.ts` (`hour` export), `apps/app/src/app/_layout.tsx`
- Modify `apps/app/test/reminders.test.tsx`

**Interfaces:** Consumes `reminderStatus`, `setReminderHour`, `testReminder`, `ReminderStatus` (Task 2); `hour(h): string` (`choices.ts`, artık export).

- [ ] **Step 1: Failing tests** — `reminders.test.tsx` importlarını `import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";` ve `import { Linking } from "react-native";` yap; `describe` içine:

```tsx
  it("clears every reminder when turned off", async () => {
    fake.permission = Permission.Granted;
    await renderRouter(APP, { initialUrl: "/settings" });
    await waitFor(() => expect(fake.scheduled.size).toBeGreaterThanOrEqual(MIN_PLANNED));
    await fireEvent.press(await screen.findByText("Hatırlatma"));
    await fireEvent.press(await screen.findByText("Kapalı"));

    await waitFor(() => expect(fake.scheduled.size).toBe(0));
    expect(await screen.findByText("Kapalı")).toBeOnTheScreen();
  });

  it("moves reminders to the new hour", async () => {
    fake.permission = Permission.Granted;
    await renderRouter(APP, { initialUrl: "/settings" });
    expect(await screen.findByText("20:00")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Hatırlatma"));
    await fireEvent.press(await screen.findByText("09:00"));

    await waitFor(() => {
      const hours = [...fake.scheduled.values()].map((r) => r.at.getHours());
      expect(hours.length).toBeGreaterThanOrEqual(MIN_PLANNED);
      expect(hours.every((h) => h === 9)).toBe(true);
    });
    expect(await screen.findByText("09:00")).toBeOnTheScreen();
  });

  it("sends to iOS Settings when permission is denied", async () => {
    fake.permission = Permission.Denied;
    const open = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    await renderRouter(APP, { initialUrl: "/settings" });
    await fireEvent.press(await screen.findByText("Kapalı · iOS Ayarları'ndan izin ver"));
    expect(open).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Fails** — `pnpm --filter @dilkart/app exec jest test/reminders.test.tsx` → yeni 3 test FAIL ("Hatırlatma" yok).

- [ ] **Step 3: Implementation**
  - `choices.ts`: `const hour = …` → `export const hour = …`.
  - `features/settings/ReminderScreen.tsx`:

```tsx
import { useCallback } from "react";

import { useLoad, useStats } from "@/services/library";
import { reminderHour } from "@/services/prefs";
import { setReminderHour, testReminder } from "@/services/reminders";
import { Group, Row, Screen } from "@/ui/components";
import { goBack } from "@/ui/navigation";

import { hour } from "./choices";

const HOURS = [9, 12, 18, 20, 21, 22];

export function ReminderScreen() {
  const stats = useStats();
  const [current] = useLoad(useCallback(() => reminderHour(), []));
  if (current === undefined) {
    return null;
  }

  const pick = async (value: number | null) => {
    await setReminderHour(stats, value);
    goBack("/settings");
  };

  return (
    <Screen>
      <Group>
        <Row title="Kapalı" selected={current === null} onPress={() => pick(null)} />
        {HOURS.map((h) => (
          <Row key={h} title={hour(h)} selected={h === current} onPress={() => pick(h)} />
        ))}
      </Group>
      {__DEV__ && (
        <Group>
          <Row title="Test: 1 dk sonra" onPress={() => void testReminder(stats)} />
        </Group>
      )}
    </Screen>
  );
}
```

  - `app/settings/reminder.tsx`:

```tsx
import { ReminderScreen } from "@/features/settings/ReminderScreen";

export default ReminderScreen;
```

  - `_layout.tsx`: `settings/choose` satırının altına:

```tsx
            <Stack.Screen name="settings/reminder" options={{ title: "Hatırlatma" }} />
```

  - `SettingsScreen.tsx`: `react-native` importuna `Linking`; `import { reminderStatus, type ReminderStatus } from "@/services/reminders";`; `./choices` importuna `hour`; `useLoad` nesnesi:

```ts
    useCallback(
      async () => ({ values: await settings.get(), failed: await failedCount(), reminder: await reminderStatus() }),
      [settings, failedCount],
    ),
```

    `<Group title="Ses">` satırının altına:

```tsx
      <Group title="Bildirim">
        <Row
          title="Hatırlatma"
          subtitle={reminderLabel(data.reminder)}
          onPress={() => (data.reminder.blocked ? void Linking.openSettings() : router.push("/settings/reminder"))}
        />
      </Group>
```

    `setScheme`'in üstüne:

```ts
function reminderLabel(r: ReminderStatus): string {
  if (r.blocked) {
    return "Kapalı · iOS Ayarları'ndan izin ver";
  }
  return r.hour === null ? "Kapalı" : hour(r.hour);
}
```

- [ ] **Step 4: Passes** — `pnpm --filter @dilkart/app exec jest` → PASS; `pnpm typecheck` → temiz; `pnpm lint` → temiz.

---

### Task 4: Doğrulama, cihaz, commit, kurulum

**Files:** Modify `docs/plan.md`

- [ ] **Step 1: Tüm kontroller**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

  Beklenen: core 353 + 7, app 75 + 5. Sunucu değişmedi; `test:sync` ve pgTAP gerekmez.

- [ ] **Step 2: Plan güncellemesi** — `docs/plan.md` bölüm 13 durum satırı: `Durum (28 Eki 2026): Aşama 0–8 bitti.` ve `Sıradaki: kart listesi ve sözlükte "Dinle" butonu, sonra Aşama 9 (web).` Bölüm 16'da "Aşama 8, istatistikler" maddesinin altına:

```markdown
- **Aşama 8, hatırlatma (28 Eki):** yalnız yerel bildirim; saat cihaza özel (varsayılan 20:00);
  7 gün önceden planlanır, o gün çalışıldıysa bugünün bildirimi düşer; seri sürüyorsa metin
  seriyi söyler. İzin ana sayfa ilk açılışta bir kez. Ayrıntı:
  `docs/superpowers/specs/2026-10-28-reminders-design.md`.
```

- [ ] **Step 3: Cihazda göster (Expo Go)** — yeni native bağımlılık için Expo sunucusunu yeniden başlat (devam dosyasındaki komut, `--clear` ile). Telefonda: izin penceresi; Ayarlar → Hatırlatma → "Test: 1 dk sonra", uygulamayı kapat, bildirim gelir ve dokununca uygulama açılır; saat değiştirme ve "Kapalı".

- [ ] **Step 4: Commit + push (kullanıcı "çalışıyor" dedikten sonra)**

```bash
git add packages/core
git commit   # "Add reminder plan to core"
git add apps/app pnpm-lock.yaml
git commit   # "Add daily study reminders"
git add docs
git commit   # "Mark reminders done in plan"
git push
```

- [ ] **Step 5: Telefona release build** — `.env.local` prod olmalı; derleme + `devicectl` (`device-release-build.md`). `expo-notifications` eklentisi `aps-environment` yetkisi ekler; otomatik imzalama push yetkisini profile ekleyemezse derleme hatası Xcode'da "Push Notifications" yetkisi olarak görünür: dur ve kullanıcıya sor. Kurmadan önce `LC_ALL=C grep -a -c 'settings/reminder' …/DilKart.app/main.jsbundle` > 0. `expo run:ios` `package.json` script'lerini değiştirirse commit'ten önce geri al.

---

### Task 5: Özel saat (28 Eki ek karar)

Spec güncellendi: saat dakika hassasiyetinde; listenin altında "Özel…" iOS saat çarkı açar.

- Core: `ReminderInput.hour` → `minute`; an `dayStart(k) + ((minute − dayStartHour·60) mod 1440)`. `Stats.reminders(minute)`. Testler dakikayla; yeni: 07:45 ve gün başlangıcından önce 01:30 (çalışma gününün gece yarısı sonrası).
- App: `prefs` `reminderMinute` / `rememberReminderMinute` (yeni anahtar `reminder.minute`, varsayılan 1200); servis `setReminderTime`, `ReminderStatus.minute`; `choices.ts` `clock(minute)` etiketi (`hour` yine özel); `ui/TimePicker.tsx` (`@expo/ui` `DatePicker`, `hourAndMinute`, `wheel`); `ReminderScreen` "Özel…" satırı + çark + "Kaydet".
- Test: `reminders.test.tsx` `@/ui/TimePicker`'ı mock'lar (basınca 07:45); "Özel…" → çark → "Kaydet" → tüm bildirimler 07:45, Ayarlar "07:45".
- Web hedefinde `@expo/ui` SwiftUI yok; Aşama 9'da `TimePicker.web.tsx` gerekir.
