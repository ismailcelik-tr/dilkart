import { beforeEach, describe, expect, it } from "vitest";

import { PULL_PAGE, PUSH_BATCH, retryDelay, sync, UpgradeRequired, type RemoteApi, type RemoteRow } from "./engine";
import { LocalStore, Table, type Op } from "./localStore";
import { testDriver } from "./testDriver";

const DECK = "0199c1d2-0000-7000-8000-0000000000d1";

class FakeRemote implements RemoteApi {
  pushed: Op[][] = [];
  pulls: number[] = [];
  rows: RemoteRow[] = [];
  failAbove = Infinity;
  upgrade = false;

  async push(ops: Op[]): Promise<void> {
    if (this.upgrade) {
      throw new UpgradeRequired();
    }
    if (ops.length > this.failAbove) {
      throw new Error("payload too large");
    }
    this.pushed.push(ops);
  }

  async pull(since: number, page: number): Promise<RemoteRow[]> {
    this.pulls.push(since);
    return this.rows.filter((r) => r.seq > since).slice(0, page);
  }
}

let store: LocalStore;
let remote: FakeRemote;

beforeEach(async () => {
  store = new LocalStore(testDriver(), "dev-a");
  await store.open();
  remote = new FakeRemote();
});

const writes = async (n: number) => {
  for (let i = 0; i < n; i++) {
    await store.write(Table.Decks, DECK, { name: `v${i}` });
  }
};

describe("sync push", () => {
  it("sends the outbox in batches and clears it", async () => {
    await writes(PUSH_BATCH * 2 + 1);
    await sync(store, remote);
    expect(remote.pushed.map((b) => b.length)).toEqual([PUSH_BATCH, PUSH_BATCH, 1]);
    expect(await store.pending(1)).toEqual([]);
  });

  it("splits a failing batch and keeps op order", async () => {
    await writes(10);
    remote.failAbove = 3;
    await sync(store, remote);
    expect(remote.pushed.flat().map((o) => o.values.name)).toEqual(Array.from({ length: 10 }, (_, i) => `v${i}`));
    expect(await store.pending(1)).toEqual([]);
  });

  it("keeps the outbox when every retry fails", async () => {
    await writes(2);
    remote.failAbove = 0;
    await expect(sync(store, remote)).rejects.toThrow();
    expect(await store.pending(10)).toHaveLength(2);
  });

  it("stops at once when an upgrade is required", async () => {
    await writes(4);
    remote.upgrade = true;
    await expect(sync(store, remote)).rejects.toBeInstanceOf(UpgradeRequired);
    expect(await store.pending(10)).toHaveLength(4);
  });
});

describe("sync pull", () => {
  it("pages from the stored cursor", async () => {
    remote.rows = Array.from({ length: PULL_PAGE + 5 }, (_, i) => ({
      seq: i + 1,
      tbl: Table.Decks,
      data: { id: `0199c1d2-0000-7000-8000-${String(i).padStart(12, "0")}`, name: `d${i}`, field_clock: {} },
    }));
    await sync(store, remote);
    expect(remote.pulls).toEqual([0, PULL_PAGE]);
    expect(await store.cursor()).toBe(PULL_PAGE + 5);

    await sync(store, remote);
    expect(remote.pulls.at(-1)).toBe(PULL_PAGE + 5);
  });
});

describe("sync result", () => {
  it("lists cards whose review logs were pulled", async () => {
    remote.rows = [
      { seq: 1, tbl: Table.ReviewLogs, data: { id: "l1", card_id: "c1", reviewed_at: "2026-10-25T06:00:00Z", rating: 3 } },
      { seq: 2, tbl: Table.ReviewLogs, data: { id: "l2", card_id: "c1", reviewed_at: "2026-10-25T07:00:00Z", rating: 3 } },
      { seq: 3, tbl: Table.ReviewLogs, data: { id: "l3", card_id: "c2", reviewed_at: "2026-10-25T07:00:00Z", rating: 1 } },
    ];
    expect((await sync(store, remote)).sort()).toEqual(["c1", "c2"]);
  });
});

describe("retryDelay", () => {
  it("doubles from one second up to five minutes", () => {
    expect([0, 1, 2, 8, 9, 20].map(retryDelay)).toEqual([1_000, 2_000, 4_000, 256_000, 300_000, 300_000]);
  });
});
