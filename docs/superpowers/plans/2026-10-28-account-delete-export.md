# Hesap silme ve dışa aktarma: uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hesap ekranından hesabı silmek (web + telefon) ve web'de verileri JSON indirmek.

**Architecture:** Sunucuda `public.delete_account()` SQL fonksiyonu (ADR 0011). Dışa aktarma
core'da saf okuma (`exportData`), app'te `Account` üzerinden; dosya indirme `drivers/download`.

**Tech Stack:** Supabase (Postgres, pgTAP), Vitest, jest-expo + RNTL, Expo Router web.

Spec: `docs/superpowers/specs/2026-10-28-account-delete-export-design.md`

## Global Constraints

- Silme onayı: başlık "Hesabı sil", metin "Hesabın, sunucudaki tüm kartların ve çalışma geçmişin
  kalıcı olarak silinecek. Geri alınamaz.", düğme "Hesabı sil".
- Silme hatası: "Hesap silinemedi; bağlantını kontrol edip yeniden dene."
- Web düğmesi "Verilerimi indir", dosya `dilkart-YYYY-MM-DD.json` (yerel gün).
- Telefon notu: "Verilerini dilkart.fly.dev'den indirebilirsin."
- Önce başarısız test. Prod migration'ı kullanıcı çalıştırır. Commit yalnız kullanıcı "çalışıyor"
  dedikten sonra (migration + pgTAP commit'i hariç tutulmaz, birlikte gider).

---

### Task 1: `public.delete_account()`

**Files:** Create `supabase/migrations/20261028180000_delete_account.sql`, `supabase/tests/delete_account.test.sql`

- [ ] **Step 1: Failing test** (`delete_account.test.sql`)

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into auth.sessions (id, user_id) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a');
insert into public.user_settings (user_id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into public.decks (id, user_id, name) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'A'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000b', 'B');
insert into public.cards (id, user_id, deck_id, front) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'go');
insert into public.review_logs (id, user_id, card_id, reviewed_at, rating, mode, tz_offset_min, elapsed_ms) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', now(), 3, 1, 180, 1200);

set local role anon;
select throws_ok('select public.delete_account()', '42501', null, 'anon cannot delete');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok('select public.delete_account()', 'A deletes own account');

reset role;
select is((select count(*) from auth.users where id = '00000000-0000-0000-0000-00000000000a')::int, 0, 'A is gone');
select is((
  select (select count(*) from public.user_settings where user_id = u) + (select count(*) from public.decks where user_id = u)
       + (select count(*) from public.cards where user_id = u) + (select count(*) from public.review_logs where user_id = u)
       + (select count(*) from public.applied_ops where user_id = u) + (select count(*) from public.card_conflicts where user_id = u)
       + (select count(*) from auth.sessions where user_id = u)
  from (select '00000000-0000-0000-0000-00000000000a'::uuid as u) x)::int, 0, 'no row of A is left');
select is((select count(*) from public.decks where user_id = '00000000-0000-0000-0000-00000000000b')::int, 1, 'B keeps its data');

select * from finish();
rollback;
```

- [ ] **Step 2: Fails** — `supabase test db` → FAIL (`function public.delete_account() does not exist`).
- [ ] **Step 3: Migration** (`20261028180000_delete_account.sql`)

```sql
-- Apple 5.1.1(v): in-app account deletion. Every user table cascades from auth.users (ADR 0011).
create function public.delete_account()
returns void
language sql volatile security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_account from public, anon;
grant execute on function public.delete_account to authenticated;
```

- [ ] **Step 4: Passes** — `supabase db reset && supabase test db` → PASS (eski testler dahil).

### Task 2: Core `exportData`

**Files:** Create `packages/core/src/data/export.ts`, `export.test.ts`; Modify `packages/core/src/index.ts`

**Interfaces:** `exportData(store: LocalStore, lib: Library, settings: Settings, now: number): Promise<Export>`;
`interface Export { app: "DilKart"; version: 1; exportedAt: string; settings: UserSettings; decks: (ExportDeck)[]; reviews: { cardId: string; reviewedAt: string; rating: number }[] }`;
`ExportDeck = { id: string; name: string; cards: ExportCard[] }`;
`ExportCard = { id; front; meanings; usageLabel?; exampleEn?; exampleTr?; isWeak }`.

- [ ] **Step 1: Failing test** (`export.test.ts`)

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { LocalStore } from "../sync/localStore";
import { testDriver } from "../sync/testDriver";
import { exportData } from "./export";
import { Library } from "./library";
import { DEFAULT_SETTINGS, Settings } from "./settings";

const NOW = Date.parse("2026-10-28T18:00:00Z");
let store: LocalStore;
let lib: Library;
let settings: Settings;

const id = (r: { ok: boolean; id?: string }) => r.id ?? "";

beforeEach(async () => {
  const db = testDriver();
  store = new LocalStore(db, "dev", () => NOW);
  await store.open();
  lib = new Library(store, db, () => NOW);
  settings = new Settings(store);
});

describe("exportData", () => {
  it("writes live decks with their cards, reviews of live cards and settings", async () => {
    const verbs = id(await lib.createDeck("Fiiller"));
    const gone = id(await lib.createDeck("Eski"));
    const go = id(await lib.createCard(verbs, { front: "go", meanings: [{ tr: "gitmek" }], exampleEn: "Let's go." }));
    const run = id(await lib.createCard(verbs, { front: "run", meanings: [{ tr: "koşmak" }] }));
    await lib.removeCard(run);
    await lib.removeDeck(gone);
    const log = { reviewed_at: "2026-10-28T08:00:00.000Z", rating: 3, mode: 1, tz_offset_min: 180, elapsed_ms: 1, scheduled: true };
    await store.append("l1", { ...log, card_id: go });
    await store.append("l2", { ...log, card_id: run });
    await settings.set({ newPerDay: 30 });

    expect(await exportData(store, lib, settings, NOW)).toEqual({
      app: "DilKart",
      version: 1,
      exportedAt: "2026-10-28T18:00:00.000Z",
      settings: { ...DEFAULT_SETTINGS, newPerDay: 30 },
      decks: [
        { id: verbs, name: "Fiiller", cards: [{ id: go, front: "go", meanings: [{ tr: "gitmek" }], exampleEn: "Let's go.", isWeak: false }] },
      ],
      reviews: [{ cardId: go, reviewedAt: "2026-10-28T08:00:00.000Z", rating: 3 }],
    });
  });
});
```

- [ ] **Step 2: Fails** — `pnpm --filter @dilkart/core exec vitest run src/data/export` → FAIL (`./export` yok).
- [ ] **Step 3: Implementation** (`export.ts`)

```ts
// Data export (KVKK portability); docs/superpowers/specs/2026-10-28-account-delete-export-design.md.
import type { Meaning } from "../card/card";
import type { LocalStore } from "../sync/localStore";
import type { Library } from "./library";
import { reviewsByCard } from "./reviews";
import type { Settings, UserSettings } from "./settings";

const FORMAT_VERSION = 1;

export interface ExportCard {
  id: string;
  front: string;
  meanings: Meaning[];
  usageLabel?: string;
  exampleEn?: string;
  exampleTr?: string;
  isWeak: boolean;
}

export interface Export {
  app: "DilKart";
  version: typeof FORMAT_VERSION;
  exportedAt: string;
  settings: UserSettings;
  decks: { id: string; name: string; cards: ExportCard[] }[];
  reviews: { cardId: string; reviewedAt: string; rating: number }[];
}

/** Live decks, cards and their review logs; scheduling state is left out, the logs rebuild it. */
export async function exportData(store: LocalStore, lib: Library, settings: Settings, now: number): Promise<Export> {
  const cards = await lib.allCards();
  const logs = await reviewsByCard(store);
  return {
    app: "DilKart",
    version: FORMAT_VERSION,
    exportedAt: new Date(now).toISOString(),
    settings: await settings.get(),
    decks: (await lib.decks()).map((d) => ({
      id: d.id,
      name: d.name,
      cards: cards
        .filter((c) => c.deckId === d.id)
        .map(({ id, front, meanings, usageLabel, exampleEn, exampleTr, isWeak }) => ({ id, front, meanings, usageLabel, exampleEn, exampleTr, isWeak })),
    })),
    reviews: cards.flatMap((c) => (logs.get(c.id) ?? []).map((r) => ({ cardId: c.id, reviewedAt: r.reviewedAt, rating: r.rating }))),
  };
}
```

  `toEqual` undefined alanları yok sayar; JSON'da da çıkmazlar. `allCards()` silinmiş destelerin
  kartlarını döndürüyorsa deste filtresi onları zaten dışarıda bırakır.
  `index.ts`: `export { exportData } from "./data/export";` + `export type { Export, ExportCard } from "./data/export";`

- [ ] **Step 4: Passes** — `pnpm --filter @dilkart/core exec vitest run` → PASS; `pnpm --filter @dilkart/core typecheck`.

### Task 3: App — silme, indirme, ekran

**Files:** Create `apps/app/src/drivers/download.ts`, `download.web.ts`, `apps/app/test/accountDelete.test.tsx`;
Modify `apps/app/src/services/library.tsx`, `features/account/AccountScreen.tsx`, `test/fakeSupabase.ts`

**Interfaces:** `Account.deleteAccount(): Promise<boolean>` (false: RPC hatası, hiçbir şey değişmedi);
`Account.exportJson(): Promise<string>`; `download(name: string, text: string): void`.

- [ ] **Step 1: Failing tests** (`accountDelete.test.tsx`; `account.test.tsx`'in `beforeEach`/`signInVia`
  kurulumu kopyalanır; `confirm` için `jest.spyOn(Alert, "alert")` yıkıcı düğmeye basar)
  - "deletes the account and its local data": giriş → "Hesabı sil" → `Alert.alert("Hesabı sil", <metin>, …)`
    → `mockSupabase.deleted` `[uid]` → `exists(userDb(uid))` false → "Hesap oluştur" görünür.
  - "keeps everything when deletion fails": `mockSupabase.outage = true` → "Hesabı sil" →
    "Hesap silinemedi; bağlantını kontrol edip yeniden dene." görünür; e-posta hâlâ ekranda; dosya var.
  - "points to the web for export on phones": "Verilerini dilkart.fly.dev'den indirebilirsin." var,
    "Verilerimi indir" yok.
  - "downloads the data on the web" (ayrı `describe`, `jest.mock("@/ui/platform", () => ({ IS_WEB: true }))`
    dosya başında olamayacağı için ayrı dosya `test/accountExport.test.tsx`; `jest.mock("@/drivers/download",
    () => ({ download: jest.fn() }))`): giriş → hesapta bir deste → "Verilerimi indir" →
    `download` `(expect.stringMatching(/^dilkart-\d{4}-\d{2}-\d{2}\.json$/), expect.stringContaining('"Fiiller"'))`.
  - `fakeSupabase.ts` `rpc`: `if (fn === "delete_account") { this.deleted.push(this.session?.user.id ?? ""); return { data: null, error: null, status: 204 }; }`; alan `deleted: string[] = []`; `beforeEach`'te sıfırlanır.
- [ ] **Step 2: Fails.**
- [ ] **Step 3: Implementation**
  - `download.web.ts`:

    ```ts
    /** Saves text as a file through the browser's download. */
    export function download(name: string, text: string): void {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    }
    ```

  - `download.ts`: `export function download(_name: string, _text: string): void { throw new Error("download is web only"); }`
  - `library.tsx` `Account`'a:

    ```ts
    deleteAccount: async () => {
      if (supabase === undefined || uid === undefined) {
        return false;
      }
      const { error: failed } = await supabase.rpc("delete_account");
      if (failed !== null) {
        return false;
      }
      retiring.current = userDb(uid);
      await supabase.auth.signOut({ scope: "local" });
      return true;
    },
    exportJson: async () => {
      const d = current.current;
      if (d === undefined) {
        throw new Error("no open database");
      }
      return JSON.stringify(await exportData(d.store, d.library, d.settings, Date.now()), null, 2);
    },
    ```
  - `AccountScreen`: `const [deleteFailed, setDeleteFailed] = useState(false);`

    ```ts
    const remove = async () => {
      if (!(await confirm("Hesabı sil", DELETE_WARNING, "Hesabı sil"))) {
        return;
      }
      setDeleteFailed(!(await account.deleteAccount()));
    };
    const save = async () => download(`dilkart-${dayStamp(new Date())}.json`, await account.exportJson());
    ```

    `dayStamp`: yerel `YYYY-MM-DD` (`getFullYear`, `getMonth() + 1`, `getDate`, `padStart(2, "0")`).
    "Çıkış yap"tan sonra: `IS_WEB ? <Button title="Verilerimi indir" onPress={save} /> : <Empty text={EXPORT_NOTE} />`,
    sonra `<Button title="Hesabı sil" kind={ButtonKind.Danger} onPress={remove} />`, `deleteFailed` ise `ErrorText`.
- [ ] **Step 4: Passes** — app jest PASS; `pnpm lint && pnpm typecheck`.

### Task 4: Doğrulama, prod, cihaz, commit

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:sync && supabase test db`.
- [ ] Kullanıcı: `! cd ~/Desktop/dilkart && supabase db push --dry-run && supabase db push`.
- [ ] Web (8081): "Verilerimi indir" dosyası; test hesabıyla "Hesabı sil" → oturumsuz ana sayfa;
  Supabase'de kullanıcı yok.
- [ ] Release build + `devicectl`; telefonda not ve "Hesabı sil" (test hesabıyla).
- [ ] "Çalışıyor" → commit'ler (supabase; core; app; docs) + push; deploy yeşil;
  `docs/plan.md` bölüm 10 (Edge Function → SQL fonksiyonu, ADR 0011), 13, 16.
