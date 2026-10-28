// Daily study reminders; docs/superpowers/specs/2026-10-28-reminders-design.md.
import { REMINDER_DAYS, type Stats } from "@dilkart/core";

import { cancel, permission, Permission, requestPermission, schedule } from "@/drivers/notifications";

import { DEFAULT_REMINDER_MINUTE, rememberReminderMinute, reminderMinute } from "./prefs";

const IDS = Array.from({ length: REMINDER_DAYS }, (_, i) => `reminder-${i}`);
const TEST_ID = "reminder-test";
const TEST_DELAY_MS = 60_000;

export interface ReminderStatus {
  /** Minutes after local midnight; null when off. */
  minute: number | null;
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
  const minute = await reminderMinute();
  if (minute === null || (await permission()) !== Permission.Granted) {
    return;
  }
  for (const [i, r] of (await stats.reminders(minute)).entries()) {
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

export const setReminderTime = (stats: Stats, minute: number | null) =>
  enqueue(async () => {
    await rememberReminderMinute(minute);
    await plan(stats);
  });

export async function reminderStatus(): Promise<ReminderStatus> {
  return { minute: await reminderMinute(), blocked: (await permission()) === Permission.Denied };
}

/** Dev only: the next reminder's text a minute from now. */
export const testReminder = (stats: Stats) =>
  enqueue(async () => {
    await askIfUnasked();
    const [next] = await stats.reminders((await reminderMinute()) ?? DEFAULT_REMINDER_MINUTE);
    if (next !== undefined) {
      await schedule(TEST_ID, new Date(Date.now() + TEST_DELAY_MS), next.title, next.body);
    }
  });
