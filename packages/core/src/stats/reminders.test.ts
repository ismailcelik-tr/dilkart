import { describe, expect, it } from "vitest";

import { reminderPlan, type ReminderInput } from "./reminders";

const DAY = 86_400_000;
const TONIGHT = Date.parse("2026-10-27T17:00:00Z"); // 20:00 Istanbul

const base: ReminderInput = {
  now: Date.parse("2026-10-27T09:00:00Z"), // 12:00 Istanbul
  minute: 20 * 60,
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

  it("keeps the minute", () => {
    expect(reminderPlan({ ...base, minute: 7 * 60 + 45 })[0]?.at.toISOString()).toBe("2026-10-28T04:45:00.000Z");
  });

  it("puts a time before the day start after that study day's midnight", () => {
    expect(reminderPlan({ ...base, minute: 90 })[0]?.at.toISOString()).toBe("2026-10-27T22:30:00.000Z"); // 01:30 Oct 28
  });

  it("encourages when nothing is due", () => {
    const plan = reminderPlan({ ...base, streak: 2 });
    expect(plan[0]?.body).toBe("Birkaç kart çalış, seri sürsün");
    expect(plan[1]?.body).toBe("Yeni bir seri başlat");
  });
});
