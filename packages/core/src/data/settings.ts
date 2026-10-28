// User settings: one synced user_settings row (plan section 16, Aşama 8).
import { SETTINGS_ID, Table, type LocalStore } from "../sync/localStore";
import type { Values } from "../sync/merge";

export enum Accent {
  US = "en-US",
  GB = "en-GB",
}

/** Stored for "no limit"; fits the smallint column. */
export const UNLIMITED = 9999;
/** Stored for "no daily goal". */
export const GOAL_OFF = 0;

export interface UserSettings {
  newPerDay: number;
  reviewsPerDay: number;
  dayStartHour: number;
  dailyGoal: number;
  accent: Accent;
}

export const DEFAULT_SETTINGS: UserSettings = {
  newPerDay: 20,
  reviewsPerDay: 200,
  dayStartHour: 4,
  dailyGoal: 50,
  accent: Accent.US,
};

const COLUMN: Record<keyof UserSettings, string> = {
  newPerDay: "daily_new_limit",
  reviewsPerDay: "daily_review_limit",
  dayStartHour: "day_start_hour",
  dailyGoal: "daily_goal",
  accent: "tts_accent",
};

type Limit = "newPerDay" | "reviewsPerDay" | "dayStartHour" | "dailyGoal";

export class Settings {
  constructor(private readonly store: LocalStore) {}

  /** Unset fields fall back to the defaults. */
  async get(): Promise<UserSettings> {
    const row = (await this.store.read(Table.Settings, SETTINGS_ID)) ?? {};
    const num = (k: Limit) => Number(row[COLUMN[k]] ?? DEFAULT_SETTINGS[k]);
    return {
      newPerDay: num("newPerDay"),
      reviewsPerDay: num("reviewsPerDay"),
      dayStartHour: num("dayStartHour"),
      dailyGoal: num("dailyGoal"),
      accent: Object.values(Accent).find((a) => a === row[COLUMN.accent]) ?? DEFAULT_SETTINGS.accent,
    };
  }

  set(changes: Partial<UserSettings>): Promise<void> {
    const values: Values = {};
    for (const [k, v] of Object.entries(changes)) {
      values[COLUMN[k as keyof UserSettings]] = v;
    }
    return this.store.write(Table.Settings, SETTINGS_ID, values);
  }
}
