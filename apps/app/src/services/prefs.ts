// Device-only preferences; not synced.
import { Direction, type Module } from "@dilkart/core";
import { Storage } from "expo-sqlite/kv-store";

const MODULE_KEY = "study.module";
const DIRECTION_KEY = "dictionary.direction";
const DECK_KEY = "deck.last";
const SCHEME_KEY = "appearance.scheme";
const REMINDER_KEY = "reminder.minute";
const REMINDER_OFF = "off";

/** Unset follows the system. */
export type Scheme = "light" | "dark";

export async function lastModule(): Promise<Module | undefined> {
  const value = await Storage.getItem(MODULE_KEY);
  return value === null ? undefined : (Number(value) as Module);
}

export async function rememberModule(module: Module): Promise<void> {
  await Storage.setItem(MODULE_KEY, String(module));
}

export async function lastDirection(): Promise<Direction> {
  const value = await Storage.getItem(DIRECTION_KEY);
  return Object.values(Direction).find((d) => d === value) ?? Direction.EnTr;
}

export async function rememberDirection(direction: Direction): Promise<void> {
  await Storage.setItem(DIRECTION_KEY, direction);
}

export async function lastDeck(): Promise<string | undefined> {
  return (await Storage.getItem(DECK_KEY)) ?? undefined;
}

export async function rememberDeck(deckId: string): Promise<void> {
  await Storage.setItem(DECK_KEY, deckId);
}

/** Sync: read before the first frame, so the app never flashes the system scheme. */
export function savedScheme(): Scheme | undefined {
  const value = Storage.getItemSync(SCHEME_KEY);
  return value === "light" || value === "dark" ? value : undefined;
}

export async function rememberScheme(scheme: Scheme): Promise<void> {
  await Storage.setItem(SCHEME_KEY, scheme);
}

export const DEFAULT_REMINDER_MINUTE = 20 * 60;

/** Minutes after local midnight; unset = 20:00, null = off. */
export async function reminderMinute(): Promise<number | null> {
  const value = await Storage.getItem(REMINDER_KEY);
  if (value === REMINDER_OFF) {
    return null;
  }
  return value === null ? DEFAULT_REMINDER_MINUTE : Number(value);
}

export async function rememberReminderMinute(minute: number | null): Promise<void> {
  await Storage.setItem(REMINDER_KEY, minute === null ? REMINDER_OFF : String(minute));
}
