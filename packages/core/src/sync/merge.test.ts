import { describe, expect, it } from "vitest";

import { merge } from "./merge";

const T1 = "000000000000001-0000-a";
const T2 = "000000000000002-0000-b";
const T3 = "000000000000003-0000-a";

describe("merge", () => {
  it("keeps fields changed on different sides", () => {
    const local = { values: { meanings: ["yeni"], deck_id: "d1" }, clock: { meanings: T2, deck_id: T1 } };
    const remote = { values: { meanings: ["eski"], deck_id: "d2" }, clock: { meanings: T1, deck_id: T3 } };
    expect(merge(local, remote)).toEqual({
      values: { meanings: ["yeni"], deck_id: "d2" },
      clock: { meanings: T2, deck_id: T3 },
    });
  });

  it("takes fields only one side has", () => {
    const local = { values: { front: "go" }, clock: { front: T1 } };
    const remote = { values: { example_en: "Go!" }, clock: { example_en: T2 } };
    expect(merge(local, remote)).toEqual({
      values: { front: "go", example_en: "Go!" },
      clock: { front: T1, example_en: T2 },
    });
  });

  it("is symmetric", () => {
    const a = { values: { front: "a", deck_id: "x" }, clock: { front: T3, deck_id: T1 } };
    const b = { values: { front: "b", deck_id: "y" }, clock: { front: T2, deck_id: T2 } };
    expect(merge(a, b)).toEqual(merge(b, a));
  });

  it("never clears a tombstone, even for a newer edit", () => {
    const local = { values: { front: "x", deleted_at: null }, clock: { front: T3, deleted_at: T3 } };
    const remote = { values: { deleted_at: "2026-10-25T00:00:00Z" }, clock: { deleted_at: T1 } };
    const merged = merge(local, remote);
    expect(merged.values.deleted_at).toBe("2026-10-25T00:00:00Z");
    expect(merged.clock.deleted_at).toBe(T1);
  });

  it("keeps the earliest of two tombstones", () => {
    const local = { values: { deleted_at: "2026-10-25T02:00:00Z" }, clock: { deleted_at: T2 } };
    const remote = { values: { deleted_at: "2026-10-25T01:00:00Z" }, clock: { deleted_at: T1 } };
    expect(merge(local, remote).values.deleted_at).toBe("2026-10-25T01:00:00Z");
    expect(merge(remote, local).values.deleted_at).toBe("2026-10-25T01:00:00Z");
  });
});
