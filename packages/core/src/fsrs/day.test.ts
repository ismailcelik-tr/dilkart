import { describe, expect, it } from "vitest";

import { dayKey } from "./day";

const ISTANBUL = 180;
const NEW_YORK = -240;
const START = 4;

describe("dayKey", () => {
  it("starts the study day at 04:00 local time", () => {
    const before = dayKey("2026-10-25T00:59:00Z", START, ISTANBUL); // 03:59 local
    const after = dayKey("2026-10-25T01:00:00Z", START, ISTANBUL); // 04:00 local
    expect(after - before).toBe(1);
  });

  it("keeps late evening and early morning in one study day", () => {
    const evening = dayKey("2026-10-25T20:00:00Z", START, ISTANBUL); // 23:00 local
    const night = dayKey("2026-10-26T00:30:00Z", START, ISTANBUL); // 03:30 local, next date
    expect(night).toBe(evening);
  });

  it("follows the device time zone", () => {
    const instant = "2026-10-25T06:00:00Z"; // 09:00 Istanbul, 02:00 New York
    expect(dayKey(instant, START, ISTANBUL) - dayKey(instant, START, NEW_YORK)).toBe(1);
  });

  it("accepts dates and strings alike", () => {
    expect(dayKey(new Date("2026-10-25T06:00:00Z"), START, ISTANBUL)).toBe(dayKey("2026-10-25T06:00:00Z", START, ISTANBUL));
  });
});
