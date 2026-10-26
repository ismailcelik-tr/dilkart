# Zayıf kelime şeridi: uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sık yanlış yapılan kartları kart kart onaylanan önerilere çevirmek, zayıf kartları pratik oturumunda çalıştırmak ve art arda 3 doğruyla listeden çıkarmak.

**Architecture:** Core'da saf `recovered` kuralı ve `WeakWords` repository'si (`suggestions`, `cards`, `decide`, `review`). `Study.answer` her cevaptan sonra `review` çağırır. Kabul anı yeni `cards.weak_since` sütununda (yerel + sunucu migration). Ekranlar `useWeakWords` üzerinden erişir.

**Tech Stack:** TypeScript, Vitest, Supabase (pgTAP, sync harness), Expo Router + jest-expo + RNTL.

Spec: `docs/superpowers/specs/2026-10-26-weak-words-design.md`

## Global Constraints

- Öneri kuralı değişmez (`suggestWeak`). Hata = `Rating.Again`.
- Red 14 gün (`dismissUntil`). Çıkış: `weak_since`'ten **sonraki** son 3 cevapta "Tekrar" yok.
- Zayıf kelime oturumu `SessionKind.Weak`; cevap pratik (`scheduled = false`), FSRS değişmez.
- Öneri adayları: son 30 günde "Tekrar" almış kartlar. Saklanmaz, her açılışta hesaplanır.
- Ekran → `services` → core. Kod/yorum/commit İngilizce, arayüz Türkçe. Önce başarısız test.
- Prod migration (`supabase db push`) yalnız kullanıcı onayıyla (Task 7).
- Commit yalnız kullanıcı cihazda "çalışıyor" dedikten sonra (Task 7).
- Komutlar repo kökünden: `~/Desktop/dilkart`.

## Dosya haritası

| Dosya | Sorumluluk |
|---|---|
| `packages/core/src/weak/weak.ts` | saf kurallar; `recovered` eklenir |
| `packages/core/src/data/reviews.ts` (yeni) | `reviewsOf(store, cardId)`: loglar → `Review[]` |
| `packages/core/src/data/weakWords.ts` (yeni) | `WeakWords` repository |
| `packages/core/src/study/study.ts` | `answer` → `WeakWords.review`; `refresh` → `reviewsOf` |
| `packages/core/src/sync/localStore.ts` | `weak_since` sütunu + migration |
| `supabase/migrations/20261026200000_cards_weak_since.sql` (yeni) | sunucu sütunu |
| `apps/app/src/features/study/cards.ts` (yeni) | `practiceCards`: zayıf / deste / tümü |
| `apps/app/src/features/weak/` (yeni) | `WeakStrip.tsx`, `SuggestionsScreen.tsx` |

Not: spec'teki `Weak (core/src/data/weak.ts)` adı `WeakWords (data/weakWords.ts)` oldu; `weak/weak.ts` ile karışmasın diye.

---

### Task 1: Çıkış kuralı `recovered`

**Files:** Modify `packages/core/src/weak/weak.ts`, `packages/core/src/weak/weak.test.ts`

**Interfaces:** Produces `recovered(reviews: Review[], since?: string): boolean`.

- [ ] **Step 1: Failing test** — `weak.test.ts` importunu `import { dismissUntil, recovered, suggestWeak } from "./weak";` yap, sona ekle:

```ts
describe("recovered", () => {
  const SINCE = new Date(NOW - 5 * DAY).toISOString();
  const goodBefore = () => [review(10 * DAY, Rating.Good), review(9 * DAY, Rating.Good), review(8 * DAY, Rating.Good)];

  it("needs three correct answers after the mark", () => {
    expect(recovered([...goodBefore(), review(2 * DAY, Rating.Good)], SINCE)).toBe(false);
    const after = [review(3 * DAY, Rating.Good), review(2 * DAY, Rating.Hard), review(DAY, Rating.Good)];
    expect(recovered([...goodBefore(), ...after], SINCE)).toBe(true);
  });

  it("restarts the count after an error", () => {
    const after = [review(4 * DAY, Rating.Good), review(3 * DAY, Rating.Good), review(2 * DAY, Rating.Again), review(DAY, Rating.Good)];
    expect(recovered(after, SINCE)).toBe(false);
  });

  it("counts every answer when the mark time is unknown", () => {
    expect(recovered([review(3 * DAY, Rating.Good), review(2 * DAY, Rating.Good), review(DAY, Rating.Good)])).toBe(true);
  });
});
```

- [ ] **Step 2: Fails** — `pnpm --filter @dilkart/core exec vitest run src/weak/weak.test.ts` → FAIL (`recovered` yok).

- [ ] **Step 3: Implementation** — `weak.ts`'te `DISMISS_MS` altına `const RECOVERY_STREAK = 3;`, `dismissUntil` altına:

```ts
/** A weak card recovers after this many answers in a row without an error since it was marked. */
export function recovered(reviews: Review[], since?: string): boolean {
  const from = since === undefined ? -Infinity : Date.parse(since);
  const last = chronological(reviews)
    .filter((r) => Date.parse(r.reviewedAt) > from)
    .slice(-RECOVERY_STREAK);
  return last.length === RECOVERY_STREAK && last.every((r) => r.rating !== Rating.Again);
}
```

- [ ] **Step 4: Passes** — aynı komut → PASS.

---

### Task 2: `weak_since` sütunu (yerel + sunucu)

**Files:**
- Modify `packages/core/src/sync/localStore.ts` (`COLUMNS[Table.Cards]`, `MIGRATIONS`)
- Create `supabase/migrations/20261026200000_cards_weak_since.sql`
- Modify `supabase/tests/sync.test.sql` (plan 23 → 24)
- Modify `tools/sync-harness/src/sync.test.ts`

**Interfaces:** Produces `cards.weak_since` (yerel `TEXT`, sunucu `timestamptz`), `LocalStore` yazımında kabul edilir.

- [ ] **Step 1: Failing tests**
  - `sync.test.sql`: `select plan(23);` → `select plan(24);`, `select * from finish();` satırından önce:

```sql
select has_column('public', 'cards', 'weak_since', 'cards keeps when a card was marked weak');
```

  - `sync.test.ts` sonuna:

```ts
describe("weak words", () => {
  it("carries the weak mark and its time to the other device", async () => {
    const { client, clock, web, phone, card } = await twoDevices();
    clock.advance();
    const since = new Date(clock.now()).toISOString();
    await web.store.write(Table.Cards, card, { is_weak: true, weak_since: since });
    await web.sync();
    await phone.sync();

    const local = await phone.store.read(Table.Cards, card);
    expect(local?.is_weak).toBe(true);
    expect(Date.parse(String(local?.weak_since))).toBe(Date.parse(since));
    const [remote] = await server(client, Table.Cards, "weak_since");
    expect(Date.parse(String(remote?.weak_since))).toBe(Date.parse(since));
  });
});
```

- [ ] **Step 2: Fails** — `supabase test db` → 1 FAIL; `pnpm test:sync` → yeni test FAIL (`weak_since` bilinmeyen sütun).

- [ ] **Step 3: Implementation**
  - `20261026200000_cards_weak_since.sql`:

```sql
-- When a card was marked weak; recovery counts answers after it (spec 2026-10-26).
alter table public.cards add column weak_since timestamptz;
```

  - Yerel Supabase'e uygula: `supabase migration up`
  - `localStore.ts` `COLUMNS[Table.Cards]` içinde `is_weak` altına `weak_since: Kind.Text,`; `MIGRATIONS` dizisinin sonuna:

```ts
  `ALTER TABLE cards ADD COLUMN weak_since TEXT;`,
```

- [ ] **Step 4: Passes** — `supabase test db` → PASS (40 → 41); `pnpm test:sync` → 17 PASS; `pnpm --filter @dilkart/core exec vitest run src/sync` → PASS (sütun ve sürüm testleri).

---

### Task 3: `WeakWords` repository

**Files:**
- Create `packages/core/src/data/reviews.ts`, `packages/core/src/data/weakWords.ts`, `packages/core/src/data/weakWords.test.ts`
- Modify `packages/core/src/study/study.ts` (`refresh`), `packages/core/src/index.ts`

**Interfaces:**
- Consumes: Task 1 `recovered`; Task 2 `weak_since`.
- Produces: `reviewsOf(store: LocalStore, cardId: string): Promise<Review[]>`; `class WeakWords { constructor(store: LocalStore, library: Library, now?: () => number); suggestions(): Promise<Card[]>; cards(): Promise<Card[]>; decide(accepted: string[], rejected: string[]): Promise<void>; review(cardId: string): Promise<void> }`.

- [ ] **Step 1: Failing test** — `weakWords.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { Rating } from "../fsrs/scheduler";
import { uuidv7 } from "../sync/id";
import { LocalStore, Table } from "../sync/localStore";
import { testDriver } from "../sync/testDriver";
import { Library } from "./library";
import { WeakWords } from "./weakWords";

const MIN = 60_000;
const DAY = 86_400_000;

let now: number;
let store: LocalStore;
let lib: Library;
let weak: WeakWords;
let deck: string;

beforeEach(async () => {
  now = Date.parse("2026-10-26T09:00:00Z");
  const db = testDriver();
  store = new LocalStore(db, "dev", () => now);
  await store.open();
  lib = new Library(store, db, () => now);
  weak = new WeakWords(store, lib, () => now);
  const created = await lib.createDeck("Fiiller");
  deck = created.ok ? created.id : "";
});

async function card(front: string) {
  const r = await lib.createCard(deck, { front, meanings: [{ tr: `${front}-tr` }] });
  return r.ok ? r.id : "";
}

async function answers(cardId: string, ratings: Rating[]) {
  for (const rating of ratings) {
    now += MIN;
    await store.append(uuidv7(now), {
      card_id: cardId,
      reviewed_at: new Date(now).toISOString(),
      rating,
      mode: 1,
      tz_offset_min: 180,
      elapsed_ms: 1_000,
      scheduled: true,
    });
  }
}

const AGAIN3 = [Rating.Again, Rating.Again, Rating.Again];
const fronts = (cards: { front: string }[]) => cards.map((c) => c.front);

describe("WeakWords", () => {
  it("suggests only cards that meet the rule", async () => {
    await answers(await card("go"), AGAIN3);
    await answers(await card("run"), [Rating.Again, Rating.Good]);
    await card("see");
    expect(fronts(await weak.suggestions())).toEqual(["go"]);
  });

  it("skips weak cards and rejected ones until the 14 days pass", async () => {
    const go = await card("go");
    const run = await card("run");
    await answers(go, AGAIN3);
    await answers(run, AGAIN3);
    now += MIN;
    await weak.decide([go], [run]);
    expect(await weak.suggestions()).toEqual([]);

    now += 15 * DAY;
    expect(fronts(await weak.suggestions())).toEqual(["run"]);
  });

  it("marks accepted cards weak and hides rejected ones for 14 days", async () => {
    const go = await card("go");
    const run = await card("run");
    await weak.decide([go], [run]);

    expect(await store.read(Table.Cards, go)).toMatchObject({ is_weak: true, weak_since: new Date(now).toISOString() });
    expect((await store.read(Table.Cards, run))?.weak_dismissed_until).toBe(new Date(now + 14 * DAY).toISOString());
    expect(fronts(await weak.cards())).toEqual(["go"]);
  });

  it("clears the mark after three correct answers since it", async () => {
    const go = await card("go");
    await answers(go, AGAIN3);
    now += MIN;
    await weak.decide([go], []);

    await answers(go, [Rating.Good, Rating.Hard]);
    await weak.review(go);
    expect((await lib.card(go))?.isWeak).toBe(true);

    await answers(go, [Rating.Good]);
    await weak.review(go);
    expect(await store.read(Table.Cards, go)).toMatchObject({ is_weak: false, weak_since: null });
  });

  it("does not count correct answers from before the mark", async () => {
    const go = await card("go");
    await answers(go, [Rating.Good, Rating.Good, Rating.Good]);
    now += MIN;
    await weak.decide([go], []);

    await answers(go, [Rating.Good]);
    await weak.review(go);
    expect((await lib.card(go))?.isWeak).toBe(true);
  });
});
```

- [ ] **Step 2: Fails** — `pnpm --filter @dilkart/core exec vitest run src/data/weakWords.test.ts` → FAIL (`./weakWords` yok).

- [ ] **Step 3: Implementation**

`data/reviews.ts`:

```ts
import type { Review } from "../fsrs/scheduler";
import { Table, type LocalStore } from "../sync/localStore";

/** A card's review logs in scheduler form. */
export async function reviewsOf(store: LocalStore, cardId: string): Promise<Review[]> {
  const logs = await store.select(Table.ReviewLogs, "card_id = ?", [cardId]);
  return logs.map((l) => ({
    id: String(l.id),
    reviewedAt: String(l.reviewed_at),
    rating: Number(l.rating),
    scheduled: l.scheduled !== false,
  }));
}
```

`data/weakWords.ts`:

```ts
// Weak-word suggestions and the weak list; docs/superpowers/specs/2026-10-26-weak-words-design.md.
import { Rating } from "../fsrs/scheduler";
import { Table, type Edit, type LocalStore } from "../sync/localStore";
import { dismissUntil, recovered, suggestWeak } from "../weak/weak";
import type { Card, Library } from "./library";
import { reviewsOf } from "./reviews";

// Both suggestion rules need a recent error, so only cards with one are checked.
const CANDIDATE_WINDOW_MS = 30 * 86_400_000;

export class WeakWords {
  constructor(
    private readonly store: LocalStore,
    private readonly library: Library,
    private readonly now: () => number = Date.now,
  ) {}

  async suggestions(): Promise<Card[]> {
    const now = this.timestamp();
    const since = new Date(this.now() - CANDIDATE_WINDOW_MS).toISOString();
    const errors = await this.store.select(Table.ReviewLogs, "rating = ? AND reviewed_at >= ?", [Rating.Again, since]);

    const found: Card[] = [];
    for (const id of new Set(errors.map((l) => String(l.card_id)))) {
      const card = await this.library.card(id);
      const row = await this.store.read(Table.Cards, id);
      if (card === undefined || row === undefined) {
        continue;
      }
      const status = { isWeak: card.isWeak, dismissedUntil: (row.weak_dismissed_until ?? null) as string | null };
      if (suggestWeak(await reviewsOf(this.store, id), now, status)) {
        found.push(card);
      }
    }
    return found.sort((a, b) => a.front.localeCompare(b.front, "tr"));
  }

  async cards(): Promise<Card[]> {
    return (await this.library.allCards()).filter((c) => c.isWeak);
  }

  /** Accepted cards become weak; rejected ones are not suggested for 14 days. */
  async decide(accepted: string[], rejected: string[]): Promise<void> {
    const now = this.timestamp();
    const until = dismissUntil(now);
    const edits: Edit[] = [
      ...accepted.map((id) => ({ table: Table.Cards, id, changes: { is_weak: true, weak_since: now } }) as Edit),
      ...rejected.map((id) => ({ table: Table.Cards, id, changes: { weak_dismissed_until: until } }) as Edit),
    ];
    if (edits.length > 0) {
      await this.store.writeAll(edits);
    }
  }

  /** Call after each answer: a recovered card leaves the weak list. */
  async review(cardId: string): Promise<void> {
    const row = await this.store.read(Table.Cards, cardId);
    if (row?.is_weak !== true) {
      return;
    }

    const since = row.weak_since == null ? undefined : String(row.weak_since);
    if (recovered(await reviewsOf(this.store, cardId), since)) {
      await this.store.write(Table.Cards, cardId, { is_weak: false, weak_since: null });
    }
  }

  private timestamp(): string {
    return new Date(this.now()).toISOString();
  }
}
```

`study.ts` `refresh` gövdesi:

```ts
    for (const id of cardIds) {
      await this.store.cacheFsrs(id, this.scheduler.replay(await reviewsOf(this.store, id)) ?? null);
    }
```

  importlar: `import { reviewsOf } from "../data/reviews";`; scheduler importundan `type Review` çıkar.

`index.ts`: `export { WeakWords } from "./data/weakWords";`

- [ ] **Step 4: Passes** — `pnpm --filter @dilkart/core exec vitest run` → hepsi PASS.

---

### Task 4: `Study.answer` çıkışı tetikler

**Files:** Modify `packages/core/src/study/study.ts`, `packages/core/src/study/study.test.ts`

**Interfaces:** Consumes Task 3 `WeakWords`. `Study` yapıcısı değişmez; `WeakWords`'ü kendisi kurar.

- [ ] **Step 1: Failing test** — `study.test.ts` importlarına `import { WeakWords } from "../data/weakWords";`, sona:

```ts
describe("Study.answer and weak words", () => {
  const WEAK = { session: SessionKind.Weak, module: Module.Recall };

  it("clears the weak mark after three correct answers without touching the schedule", async () => {
    study = await setup();
    const [id = ""] = await cards(1);
    await new WeakWords(store, lib, () => now).decide([id], []);

    for (let i = 0; i < 3; i++) {
      now += MIN;
      expect((await lib.card(id))?.isWeak).toBe(true);
      await study.answer(await cardOf(id), Rating.Good, WEAK, 1_000);
    }

    const card = await lib.card(id);
    expect(card?.isWeak).toBe(false);
    expect(card?.fsrs).toBeUndefined();
  });
});
```

- [ ] **Step 2: Fails** — `pnpm --filter @dilkart/core exec vitest run src/study/study.test.ts -t "weak mark"` → FAIL (`isWeak` true kalır).

- [ ] **Step 3: Implementation** — `study.ts`:
  - `import { WeakWords } from "../data/weakWords";`
  - sınıfa alan `private readonly weak: WeakWords;`, yapıcı gövdesine `this.weak = new WeakWords(store, library, now);`
  - `answer` içinde `await this.store.append(...)` çağrısından hemen sonra, `if (!scheduled)` öncesinde:

```ts
    await this.weak.review(card.id);
```

- [ ] **Step 4: Passes** — `pnpm --filter @dilkart/core exec vitest run` → PASS.

---

### Task 5: Ana sayfa şeridi ve öneri listesi

**Files:**
- Modify `apps/app/src/services/openData.ts`, `apps/app/test/testData.ts`, `apps/app/src/services/library.tsx`
- Create `apps/app/src/features/weak/WeakStrip.tsx`, `apps/app/src/features/weak/SuggestionsScreen.tsx`, `apps/app/src/app/weak/suggestions.tsx`
- Modify `apps/app/src/features/decks/DeckListScreen.tsx`, `apps/app/src/app/_layout.tsx`
- Test: `apps/app/test/weak.test.tsx` (yeni)

**Interfaces:**
- Consumes: Task 3 `WeakWords`.
- Produces: `AppData.weak: WeakWords`; `useWeakWords(): WeakWords`; rota `/weak/suggestions`.

- [ ] **Step 1: Failing test** — `apps/app/test/weak.test.tsx`:

```tsx
import { Rating, Table, uuidv7 } from "@dilkart/core";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { openData } from "@/services/openData";

import { testData } from "./testData";

jest.mock("@/services/openData", () => ({ openData: jest.fn() }));

const APP = "./src/app";
let data: Awaited<ReturnType<typeof testData>>;
let deckId: string;

beforeEach(async () => {
  data = await testData();
  jest.mocked(openData).mockResolvedValue(data);
  const deck = await data.library.createDeck("Fiiller");
  deckId = deck.ok ? deck.id : "";
});

async function card(front: string) {
  const r = await data.library.createCard(deckId, { front, meanings: [{ tr: `${front}-tr` }] });
  return r.ok ? r.id : "";
}

/** Three wrong answers in a row: enough for a suggestion. */
async function struggling(front: string) {
  const id = await card(front);
  for (let i = 3; i > 0; i--) {
    const at = Date.now() - i * 60_000;
    await data.store.append(uuidv7(at), {
      card_id: id,
      reviewed_at: new Date(at).toISOString(),
      rating: Rating.Again,
      mode: 1,
      tz_offset_min: 180,
      elapsed_ms: 1_000,
      scheduled: true,
    });
  }
  return id;
}

describe("weak strip", () => {
  it("stays hidden when nothing is weak", async () => {
    await card("go");
    await renderRouter(APP, { initialUrl: "/" });
    await screen.findByText("Fiiller");
    expect(screen.queryByText(/zayıf kelime|yeni öneri/)).toBeNull();
  });

  it("counts weak words and suggestions", async () => {
    const go = await struggling("go");
    await struggling("run");
    await data.weak.decide([go], []);

    await renderRouter(APP, { initialUrl: "/" });
    expect(await screen.findByText("1 zayıf kelime")).toBeOnTheScreen();
    expect(screen.getByText("1 yeni öneri")).toBeOnTheScreen();
  });
});

describe("suggestions", () => {
  it("accepts the checked words and rejects the unchecked ones", async () => {
    const go = await struggling("go");
    const run = await struggling("run");

    await renderRouter(APP, { initialUrl: "/weak/suggestions" });
    await fireEvent.press(await screen.findByText("run"));
    await fireEvent.press(screen.getByText("Onayla"));

    await waitFor(async () => expect((await data.library.card(go))?.isWeak).toBe(true));
    expect((await data.library.card(run))?.isWeak).toBe(false);
    expect((await data.store.read(Table.Cards, run))?.weak_dismissed_until).toEqual(expect.any(String));
  });

  it("says so when there is nothing to review", async () => {
    await renderRouter(APP, { initialUrl: "/weak/suggestions" });
    expect(await screen.findByText("Öneri yok")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Fails** — `pnpm --filter @dilkart/app exec jest test/weak.test.tsx` → FAIL (`data.weak` yok / rota yok).

- [ ] **Step 3: Implementation**

`openData.ts`: importa `WeakWords`; `AppData`'ya `weak: WeakWords;`; dönüşe `weak: new WeakWords(store, library),`.
`testData.ts`: importa `WeakWords`; `data`'ya `weak: new WeakWords(store, library),`.
`services/library.tsx`: importa `type WeakWords`; `useSettings` altına:

```ts
export const useWeakWords = (): WeakWords => useData().weak;
```

`features/weak/WeakStrip.tsx`:

```tsx
import { router } from "expo-router";

import { Group, Row } from "@/ui/components";

/** Hidden when both counts are zero. */
export function WeakStrip({ weak, suggested }: { weak: number; suggested: number }) {
  if (weak === 0 && suggested === 0) {
    return null;
  }

  return (
    <Group>
      {weak > 0 && (
        <Row
          title={`${weak} zayıf kelime`}
          subtitle="Çalış"
          onPress={() => router.push({ pathname: "/study", params: { weak: "1" } })}
        />
      )}
      {suggested > 0 && (
        <Row title={`${suggested} yeni öneri`} subtitle="Gözden geçir" onPress={() => router.push("/weak/suggestions")} />
      )}
    </Group>
  );
}
```

`features/weak/SuggestionsScreen.tsx`:

```tsx
import { useCallback, useState } from "react";

import { useLoad, useWeakWords } from "@/services/library";
import { Button, ButtonKind, Empty, Group, Row, Screen } from "@/ui/components";
import { goBack } from "@/ui/navigation";

export function SuggestionsScreen() {
  const weak = useWeakWords();
  const [cards] = useLoad(useCallback(() => weak.suggestions(), [weak]));
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  if (cards === undefined) {
    return null;
  }
  if (cards.length === 0) {
    return <Empty text="Öneri yok" />;
  }

  const toggle = (id: string) => {
    const next = new Set(rejected);
    if (!next.delete(id)) {
      next.add(id);
    }
    setRejected(next);
  };

  const confirm = async () => {
    const accepted = cards.filter((c) => !rejected.has(c.id)).map((c) => c.id);
    await weak.decide(accepted, [...rejected]);
    goBack("/");
  };

  return (
    <Screen>
      <Empty text="Zayıf olmadığını düşündüğün kelimenin işaretini kaldır." />
      <Group>
        {cards.map((c) => (
          <Row
            key={c.id}
            title={c.front}
            subtitle={c.meanings.map((m) => m.tr).join(", ")}
            selected={!rejected.has(c.id)}
            onPress={() => toggle(c.id)}
          />
        ))}
      </Group>
      <Button title="Onayla" kind={ButtonKind.Primary} onPress={confirm} />
    </Screen>
  );
}
```

`app/weak/suggestions.tsx`:

```tsx
import { SuggestionsScreen } from "@/features/weak/SuggestionsScreen";

export default SuggestionsScreen;
```

`_layout.tsx` — `settings/choose` satırından sonra:

```tsx
            <Stack.Screen name="weak/suggestions" options={{ title: "Zayıf kelime önerileri" }} />
```

`DeckListScreen.tsx`:
  - importlar: `useWeakWords` (`@/services/library`), `import { WeakStrip } from "@/features/weak/WeakStrip";`
  - yükleme:

```tsx
  const lib = useLibrary();
  const weak = useWeakWords();
  const [data, reload] = useLoad(
    useCallback(
      async (l) => ({
        decks: await l.decks(),
        weak: (await weak.cards()).length,
        suggested: (await weak.suggestions()).length,
      }),
      [weak],
    ),
  );
  if (data === undefined) {
    return null;
  }

  const { decks } = data;
```

  - dolu durumda `Tümünü çalış` butonundan önce `<WeakStrip weak={data.weak} suggested={data.suggested} />`.

- [ ] **Step 4: Passes** — `pnpm --filter @dilkart/app exec jest test/weak.test.tsx test/library.test.tsx` → PASS.

---

### Task 6: Zayıf kelime oturumu

**Files:**
- Create `apps/app/src/features/study/cards.ts`
- Modify `apps/app/src/features/study/StudyStartScreen.tsx`, `StudySessionScreen.tsx`, `MatchScreen.tsx`
- Modify `apps/app/src/app/study/index.tsx`, `session.tsx`, `match.tsx`
- Test: `apps/app/test/weak.test.tsx`

**Interfaces:**
- Consumes: Task 5 `useWeakWords`.
- Produces: `practiceCards(lib: Library, weak: WeakWords, kind: SessionKind, deckId?: string): Promise<Card[]>`; `/study?weak=1`; session/match `kind=weak`.

- [ ] **Step 1: Failing test** — `weak.test.tsx` sonuna:

```tsx
describe("weak session", () => {
  it("studies only weak words, as practice", async () => {
    const go = await struggling("go");
    await card("see");
    await data.weak.decide([go], []);

    await renderRouter(APP, { initialUrl: "/study?weak=1" });
    expect(await screen.findByText("Zayıf 1")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Anlam hatırlama"));
    await fireEvent.press(screen.getByText("Başla"));

    expect(await screen.findByText("go")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Cevabı göster"));
    await fireEvent.press(await screen.findByText("İyi"));

    expect(await screen.findByText("Oturum bitti")).toBeOnTheScreen();
    const logs = await data.store.select(Table.ReviewLogs, "card_id = ? AND rating = ?", [go, Rating.Good]);
    expect(logs).toMatchObject([{ scheduled: false }]);
  });
});
```

- [ ] **Step 2: Fails** — `pnpm --filter @dilkart/app exec jest test/weak.test.tsx -t "weak session"` → FAIL ("Zayıf 1" yok).

- [ ] **Step 3: Implementation**

`features/study/cards.ts`:

```ts
import { SessionKind, type Card, type Library, type WeakWords } from "@dilkart/core";

/** Cards a practice sitting draws from: the weak list, one deck, or every deck. */
export function practiceCards(lib: Library, weak: WeakWords, kind: SessionKind, deckId?: string): Promise<Card[]> {
  if (kind === SessionKind.Weak) {
    return weak.cards();
  }
  return deckId === undefined ? lib.allCards() : lib.cards(deckId);
}
```

`app/study/index.tsx`:

```tsx
export default function StudyStart() {
  const { deckId, weak } = useLocalSearchParams<{ deckId?: string; weak?: string }>();
  return <StudyStartScreen deckId={deckId} weak={weak === "1"} />;
}
```

`app/study/session.tsx` — `kind` satırı:

```tsx
  const kind = Object.values(SessionKind).find((k) => k === p.kind) ?? SessionKind.Review;
```

`app/study/match.tsx`:

```tsx
import { SessionKind } from "@dilkart/core";
import { useLocalSearchParams } from "expo-router";

import { MatchScreen } from "@/features/study/MatchScreen";

export default function Match() {
  const { deckId, kind } = useLocalSearchParams<{ deckId?: string; kind?: string }>();
  return <MatchScreen deckId={deckId} kind={kind === SessionKind.Weak ? SessionKind.Weak : SessionKind.Free} />;
}
```

`StudyStartScreen.tsx`:
  - imza `export function StudyStartScreen({ deckId, weak = false }: { deckId?: string; weak?: boolean })`; `const weakWords = useWeakWords();` (`@/services/library` importuna ekle); `import { practiceCards } from "./cards";`
  - yükleme:

```tsx
  const [data] = useLoad(
    useCallback(
      async (lib) => ({
        plan: weak ? undefined : await study.plan(deckId),
        saved: await lastModule(),
        cardCount: (await practiceCards(lib, weakWords, weak ? SessionKind.Weak : SessionKind.Free, deckId)).length,
      }),
      [study, weakWords, deckId, weak],
    ),
  );
```

  - `const { counts } = data.plan;` ve `const nothingDue = ...` satırlarını sil; `return`'den önce:

```tsx
  const { plan } = data;
  const summary =
    plan === undefined
      ? `Zayıf ${data.cardCount}`
      : `Yeni ${plan.counts.new} · Tekrar ${plan.counts.review} · Öğrenme ${plan.counts.learning}`;

  const start = () => {
    if (plan === undefined) {
      return data.cardCount === 0 ? (
        <Empty text="Zayıf kelime yok" />
      ) : (
        <Button title="Başla" kind={ButtonKind.Primary} onPress={() => go(SessionKind.Weak)} />
      );
    }
    if (plan.cards.length === 0 && module !== Module.Match) {
      return (
        <>
          <Empty text="Bugünlük bitti" />
          <Button title="Serbest çalış" kind={ButtonKind.Primary} onPress={() => go(SessionKind.Free)} />
        </>
      );
    }
    return <Button title="Başla" kind={ButtonKind.Primary} onPress={() => go(SessionKind.Review)} />;
  };
```

  - JSX: ilk `<Empty>` → `<Empty text={summary} />`; sondaki üçlü ifade bloğu → `{start()}`.

`StudySessionScreen.tsx`: `const weak = useWeakWords();` (importa ekle), `import { practiceCards } from "./cards";`; yükleme:

```tsx
      const cards =
        kind === SessionKind.Review
          ? (await study.plan(deckId)).cards
          : shuffle(await practiceCards(lib, weak, kind, deckId));
```

  ve effect bağımlılıklarına `weak`.

`MatchScreen.tsx`: imza `export function MatchScreen({ deckId, kind }: { deckId?: string; kind: SessionKind })`; `const weak = useWeakWords();`; `import { practiceCards } from "./cards";`; yükleme `const list = await practiceCards(lib, weak, kind, deckId);`; bağımlılıklar `[lib, weak, kind, deckId, newRound]`.

- [ ] **Step 4: Passes** — `pnpm --filter @dilkart/app test` → hepsi PASS.

---

### Task 7: Doğrulama, cihaz, prod migration, commit, kurulum

**Files:** Modify `docs/plan.md`

- [ ] **Step 1: Tüm kontroller**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:sync && supabase test db
```

- [ ] **Step 2: Plan güncellemesi** — `docs/plan.md` bölüm 13: `Durum (26 Eki 2026): Aşama 0–7 bitti; Aşama 8'de Ayarlar ve zayıf kelimeler bitti. Sıradaki: İstatistik sayfası.` Bölüm 16'da "Aşama 8, Ayarlar" maddesinin altına:

```markdown
- **Aşama 8, zayıf kelimeler (26 Eki):** öneriler kart kart onaylanır (✓ listesi); kabul anı
  `cards.weak_since`; art arda 3 doğruyla otomatik çıkış; "Gizle" yerine kart kart red (14 gün).
  Ayrıntı: `docs/superpowers/specs/2026-10-26-weak-words-design.md`.
```

- [ ] **Step 3: Cihazda göster** — yeniden yükleme gönder:

```bash
node -e 'const w=new WebSocket("ws://127.0.0.1:8081/message");w.onopen=()=>{w.send(JSON.stringify({version:2,method:"reload"}));setTimeout(()=>process.exit(0),500)}'
```

  Not: Expo Go prod'a bağlı. Prod'da `weak_since` sütunu yokken `sync.normalize` bilinmeyen alanı sessizce düşürür: `is_weak` sunucuya gider, `weak_since` gitmez ve diğer cihazda çıkış kuralı kabul anını bilemez. Bu yüzden telefonda denemeden **önce** Step 4'teki prod migration için onay istenir. Onay gelmezse gösterim simülatörde (yerel Supabase) yapılır.

- [ ] **Step 4: Prod migration (kullanıcı onayıyla)**

```bash
supabase db push --dry-run   # yalnız 20261026200000_cards_weak_since görünmeli
supabase db push
```

- [ ] **Step 5: Commit + push (kullanıcı "çalışıyor" dedikten sonra)**

```bash
git add packages/core supabase tools/sync-harness
git commit   # "Add weak words to core" + body + Co-Authored-By
git add apps/app
git commit   # "Add weak word strip and suggestions"
git add docs
git commit   # "Mark weak words done in plan"
git push
```

- [ ] **Step 6: Telefona release build** — `.env.local` prod olmalı; derleme + `devicectl` ile kurulum (`device-release-build.md`).
