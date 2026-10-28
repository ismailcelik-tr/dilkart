import { beforeEach, describe, expect, it } from "vitest";

import { LocalStore } from "../sync/localStore";
import { testDriver } from "../sync/testDriver";
import { Accent, DEFAULT_SETTINGS, GOAL_OFF, Settings, UNLIMITED } from "./settings";

let store: LocalStore;
let settings: Settings;

beforeEach(async () => {
  store = new LocalStore(testDriver());
  await store.open();
  settings = new Settings(store);
});

describe("Settings", () => {
  it("defaults the daily goal to 50 and stores it off", async () => {
    expect((await settings.get()).dailyGoal).toBe(50);
    await settings.set({ dailyGoal: GOAL_OFF });
    expect((await settings.get()).dailyGoal).toBe(GOAL_OFF);
  });

  it("returns the defaults when nothing is set", async () => {
    expect(await settings.get()).toEqual(DEFAULT_SETTINGS);
  });

  it("reads back what it wrote and keeps the rest default", async () => {
    await settings.set({ newPerDay: 30, accent: Accent.GB });
    expect(await settings.get()).toEqual({ ...DEFAULT_SETTINGS, newPerDay: 30, accent: Accent.GB });
  });

  it("keeps midnight as a day start", async () => {
    await settings.set({ dayStartHour: 0 });
    expect((await settings.get()).dayStartHour).toBe(0);
  });

  it("stores unlimited reviews", async () => {
    await settings.set({ reviewsPerDay: UNLIMITED });
    expect((await settings.get()).reviewsPerDay).toBe(UNLIMITED);
  });

  it("queues the change for sync under the server's column names", async () => {
    await settings.set({ newPerDay: 10 });
    const [first] = await store.pending(10);
    expect(first?.op).toMatchObject({ table: "user_settings", values: { daily_new_limit: 10 } });
  });
});
