// PoC-B acceptance scenarios; docs/plan.md section 12. Needs `supabase start`.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Scheduler, SCHEMA_VERSION, Table, UpgradeRequired, uuidv7 } from "@dilkart/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { device, signUp } from "./local";
import { supabaseRemote } from "./remote";

const T0 = 1_761_379_200_000;
const STEP_MS = 1_000;
const OFFLINE_SYNC_BUDGET_MS = 60_000;
const INITIAL_SYNC_BUDGET_MS = 30_000;
const SEED_CARDS = 5_000;
const LOGS_PER_CARD = 10;

function manualClock() {
  let t = T0;
  return { now: () => t, advance: () => (t += STEP_MS) };
}

async function server(client: SupabaseClient, table: Table, columns = "*") {
  const { data, error } = await client.from(table).select(columns);
  if (error) {
    throw error;
  }
  return data as unknown as Record<string, unknown>[];
}

async function serverCount(client: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) {
    throw error;
  }
  return count ?? 0;
}

let logSeq = 0;
const log = (cardId: string, rating: number) => ({
  card_id: cardId,
  reviewed_at: new Date(T0 + logSeq++ * STEP_MS).toISOString(),
  rating,
  mode: 1,
  tz_offset_min: 180,
  elapsed_ms: 1_000,
});

/** A user with two devices that both hold one deck pair and one card. */
async function twoDevices() {
  const client = await signUp();
  const clock = manualClock();
  const web = await device("web", client, { now: clock.now });
  const phone = await device("phone", client, { now: clock.now });
  const decks = [uuidv7(), uuidv7()] as const;
  const card = uuidv7();

  await web.store.write(Table.Decks, decks[0], { name: "Fiiller" });
  await web.store.write(Table.Decks, decks[1], { name: "Tekrar" });
  await web.store.write(Table.Cards, card, { deck_id: decks[0], front: "go", meanings: [{ tr: "gitmek" }] });
  await web.sync();
  await phone.sync();
  return { client, clock, web, phone, decks, card };
}

describe("idempotency", () => {
  it("applies a batch sent five times once", async () => {
    const client = await signUp();
    const a = await device("a", client);
    const deck = uuidv7();
    const card = uuidv7();
    await a.store.write(Table.Decks, deck, { name: "d" });
    await a.store.write(Table.Cards, card, { deck_id: deck, front: "go" });
    await a.store.write(Table.Cards, card, { front: "went" });
    await a.store.append(uuidv7(), log(card, 3));

    const ops = (await a.store.pending(10)).map((p) => p.op);
    const remote = supabaseRemote(client);
    for (let i = 0; i < 5; i++) {
      await remote.push(ops, SCHEMA_VERSION);
    }

    expect(await server(client, Table.Cards, "id, front")).toEqual([{ id: card, front: "went" }]);
    expect(await serverCount(client, Table.ReviewLogs)).toBe(1);
    expect(await serverCount(client, "card_conflicts")).toBe(0);
  });
});

describe("conflicts", () => {
  it("keeps edits to different fields from two devices", async () => {
    const { client, clock, web, phone, decks, card } = await twoDevices();
    clock.advance();
    await web.store.write(Table.Cards, card, { meanings: [{ tr: "gitmek" }, { tr: "yürümek" }] });
    clock.advance();
    await phone.store.write(Table.Cards, card, { deck_id: decks[1] });

    await web.sync();
    await phone.sync();
    await web.sync();

    const expected = { deck_id: decks[1], meanings: [{ tr: "gitmek" }, { tr: "yürümek" }] };
    expect(await web.store.read(Table.Cards, card)).toMatchObject(expected);
    expect(await phone.store.read(Table.Cards, card)).toMatchObject(expected);
    expect((await server(client, Table.Cards))[0]).toMatchObject(expected);
    expect(await serverCount(client, "card_conflicts")).toBe(0);
  });

  it.each([
    ["older edit arrives first", true],
    ["newer edit arrives first", false],
  ])("same field: newer HLC wins and the loser is logged (%s)", async (_, webFirst) => {
    const { client, clock, web, phone, card } = await twoDevices();
    clock.advance();
    await web.store.write(Table.Cards, card, { front: "went" });
    clock.advance();
    await phone.store.write(Table.Cards, card, { front: "gone" });

    const [first, second] = webFirst ? [web, phone] : [phone, web];
    await first.sync();
    await second.sync();
    await first.sync();

    expect((await web.store.read(Table.Cards, card))?.front).toBe("gone");
    expect((await phone.store.read(Table.Cards, card))?.front).toBe("gone");
    expect(await server(client, Table.Cards, "front")).toEqual([{ front: "gone" }]);
    expect(await server(client, "card_conflicts" as Table, "field, loser")).toEqual([{ field: "front", loser: "went" }]);
  });

  it("delete wins over a later concurrent edit", async () => {
    const { client, clock, web, phone, card } = await twoDevices();
    clock.advance();
    await web.store.write(Table.Cards, card, { deleted_at: new Date(clock.now()).toISOString() });
    clock.advance();
    await phone.store.write(Table.Cards, card, { front: "went" });

    await phone.sync();
    await web.sync();
    await phone.sync();

    expect((await web.store.read(Table.Cards, card))?.deleted_at).not.toBeNull();
    expect((await phone.store.read(Table.Cards, card))?.deleted_at).not.toBeNull();
    expect((await server(client, Table.Cards, "deleted_at"))[0]?.deleted_at).not.toBeNull();
  });
});

describe("review history", () => {
  it("unions offline reviews from two devices", async () => {
    const { client, web, phone, card } = await twoDevices();
    for (let i = 0; i < 30; i++) {
      await web.store.append(uuidv7(), log(card, 3));
    }
    for (let i = 0; i < 20; i++) {
      await phone.store.append(uuidv7(), log(card, 1));
    }

    await web.sync();
    await phone.sync();
    await web.sync();

    expect(await serverCount(client, Table.ReviewLogs)).toBe(50);
    expect(await web.count(Table.ReviewLogs)).toBe(50);
    expect(await phone.count(Table.ReviewLogs)).toBe(50);

    const scheduler = new Scheduler();
    const onWeb = scheduler.replay(await web.reviews(card));
    expect(onWeb).toBeDefined();
    expect(scheduler.replay(await phone.reviews(card))).toEqual(onWeb);
  });
});

describe("offline", () => {
  it("delivers 100 offline changes once after a restart", async () => {
    const client = await signUp();
    const path = join(mkdtempSync(join(tmpdir(), "dilkart-")), "user.sqlite");
    const before = await device("a", client, { path });
    const deck = uuidv7();
    await before.store.write(Table.Decks, deck, { name: "Uçakta" });
    for (let i = 0; i < 99; i++) {
      await before.store.write(Table.Cards, uuidv7(), { deck_id: deck, front: `w${i}` });
    }
    before.close();

    const after = await device("a", client, { path });
    const started = performance.now();
    await after.sync();
    const elapsed = performance.now() - started;
    await after.sync();

    expect(await serverCount(client, Table.Decks)).toBe(1);
    expect(await serverCount(client, Table.Cards)).toBe(99);
    expect(await after.store.pending(1)).toEqual([]);
    expect(elapsed).toBeLessThan(OFFLINE_SYNC_BUDGET_MS);
  });

  it("rejects an outdated client and keeps its data", async () => {
    const client = await signUp();
    const a = await device("a", client);
    await a.store.write(Table.Decks, uuidv7(), { name: "d" });
    const ops = (await a.store.pending(10)).map((p) => p.op);

    await expect(supabaseRemote(client).push(ops, SCHEMA_VERSION - 1)).rejects.toBeInstanceOf(UpgradeRequired);
    expect(await serverCount(client, Table.Decks)).toBe(0);
    expect(await a.store.pending(10)).toHaveLength(1);
  });
});

describe("guest", () => {
  it("uploads 50 guest cards with the same ids after sign-up", async () => {
    const guest = await device("guest");
    const deck = uuidv7();
    const cards = Array.from({ length: 50 }, () => uuidv7());
    await guest.store.write(Table.Decks, deck, { name: "Misafir" });
    for (const [i, id] of cards.entries()) {
      await guest.store.write(Table.Cards, id, { deck_id: deck, front: `g${i}` });
    }

    const client = await signUp();
    guest.login(client);
    await guest.sync();

    const ids = (await server(client, Table.Cards, "id")).map((r) => r.id);
    expect(ids.sort()).toEqual([...cards].sort());
  });
});

describe("initial sync", () => {
  it(
    `pulls ${SEED_CARDS} cards and ${SEED_CARDS * LOGS_PER_CARD} logs within budget`,
    async () => {
      const client = await signUp();
      const seeder = await device("seed", client);
      const deck = uuidv7();
      await seeder.store.write(Table.Decks, deck, { name: "Büyük" });
      for (let i = 0; i < SEED_CARDS; i++) {
        const card = uuidv7();
        await seeder.store.write(Table.Cards, card, { deck_id: deck, front: `w${i}`, meanings: [{ tr: `k${i}` }] });
        for (let j = 0; j < LOGS_PER_CARD; j++) {
          await seeder.store.append(uuidv7(), log(card, (j % 4) + 1));
        }
      }

      let started = performance.now();
      await seeder.sync();
      const pushMs = performance.now() - started;

      const fresh = await device("new", client);
      started = performance.now();
      await fresh.sync();
      const pullMs = performance.now() - started;
      console.log("INITIAL_SYNC", JSON.stringify({ pushMs: Math.round(pushMs), pullMs: Math.round(pullMs) }));

      expect(await fresh.count(Table.Cards)).toBe(SEED_CARDS);
      expect(await fresh.count(Table.ReviewLogs)).toBe(SEED_CARDS * LOGS_PER_CARD);
      expect(pullMs).toBeLessThan(INITIAL_SYNC_BUDGET_MS);
    },
    10 * 60_000,
  );
});
