import { beforeEach, describe, expect, it } from "vitest";

import {
  ClockAhead,
  PermanentError,
  PULL_PAGE,
  PUSH_BATCH,
  retryDelay,
  sync,
  UpgradeRequired,
  type RemoteApi,
  type RemoteRow,
} from "./engine";
import { LocalStore, Table, type Op } from "./localStore";
import { testDriver } from "./testDriver";

const DECK = "0199c1d2-0000-7000-8000-0000000000d1";

const NOW = Date.parse("2026-10-25T12:00:00Z");
const DAY = 86_400_000;

class FakeRemote implements RemoteApi {
  pushed: Op[][] = [];
  pushCalls = 0;
  pulls: number[] = [];
  rows: RemoteRow[] = [];
  failAbove = Infinity;
  rejectName?: string;
  outage = false;
  upgrade = false;
  serverNow = NOW;

  async push(ops: Op[]): Promise<void> {
    this.pushCalls++;
    if (this.upgrade) {
      throw new UpgradeRequired();
    }
    if (this.outage) {
      throw new Error("network down");
    }
    if (ops.length > this.failAbove) {
      throw new PermanentError("payload too large");
    }
    if (ops.some((o) => o.values.name === this.rejectName)) {
      throw new PermanentError("22P02 invalid input");
    }
    this.pushed.push(ops);
  }

  async serverTime(): Promise<number> {
    return this.serverNow;
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

  it("retries an outage later without splitting", async () => {
    await writes(4);
    remote.outage = true;
    await expect(sync(store, remote, () => NOW)).rejects.toThrow("network down");
    expect(remote.pushCalls).toBe(1);
    expect(await store.pending(10)).toHaveLength(4);
  });

  it("parks an op the server always rejects and sends the rest", async () => {
    await writes(5);
    remote.rejectName = "v2";
    await sync(store, remote, () => NOW);

    expect(remote.pushed.flat().map((o) => o.values.name)).toEqual(["v0", "v1", "v3", "v4"]);
    expect(await store.pending(10)).toEqual([]);
    expect(await store.failed()).toEqual([
      expect.objectContaining({ op: expect.objectContaining({ values: { name: "v2" } }), error: "22P02 invalid input" }),
    ]);
  });

  it("sends nothing while the device clock runs over a day ahead", async () => {
    await writes(2);
    remote.serverNow = NOW - 2 * DAY;
    await expect(sync(store, remote, () => NOW)).rejects.toBeInstanceOf(ClockAhead);
    expect(remote.pushCalls).toBe(0);
    expect(remote.pulls).toEqual([]);
    expect(await store.pending(10)).toHaveLength(2);
  });

  it("tolerates a device clock that is behind", async () => {
    await writes(1);
    remote.serverNow = NOW + 3 * DAY;
    await sync(store, remote, () => NOW);
    expect(await store.pending(10)).toEqual([]);
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
