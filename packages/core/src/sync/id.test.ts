import { describe, expect, it } from "vitest";

import { uuidv7 } from "./id";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7", () => {
  it("has the v7 layout", () => {
    expect(uuidv7()).toMatch(UUID_V7);
  });

  it("encodes the timestamp in the first 48 bits", () => {
    const ms = 1_761_379_200_000;
    expect(uuidv7(ms).replace("-", "").slice(0, 12)).toBe(ms.toString(16).padStart(12, "0"));
  });

  it("sorts by time", () => {
    const ids = [1, 2, 1_000, 1_761_379_200_000].map((ms) => uuidv7(ms));
    expect([...ids].sort()).toEqual(ids);
  });

  it("is unique within a millisecond", () => {
    const ids = new Set(Array.from({ length: 1_000 }, () => uuidv7(5)));
    expect(ids.size).toBe(1_000);
  });
});
