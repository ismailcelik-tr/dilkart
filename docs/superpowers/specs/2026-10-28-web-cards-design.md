# Web'de deste ve kart yönetimi + toplu ekleme (Aşama 9a)

Tarih: 28 Eki 2026 · Durum: onaylandı

## Amaç

Bilgisayarın tarayıcısından giriş yapıp deste ve kart oluşturmak (toplu yapıştırma dahil);
kartlar hesap sync'iyle telefona gider.

## Kapsam

- **9a (bu spec):** web'de giriş, deste/kart yönetimi, toplu ekleme; yerelde çalışır.
- **9b:** Fly'da yayın (Dockerfile, Caddy, `fly.toml`, deploy workflow).
- **9c:** hesap silme ve dışa aktarma.

## Kurallar

- **Veri (ADR 0010):** web'de de `expo-sqlite` (wa-sqlite, OPFS) + `LocalStore` + `SyncService`;
  mobil ile aynı kod. Sunucu tablolarına doğrudan yazılmaz (ADR 0008).
- **Sözlük paketi web'e girmez:** paketin `require`'ı platform dosyasına (`.web.ts`) ayrılır;
  web'de sözlük açılmaz.
- **Hesap zorunlu:** web'de oturum yoksa ana sayfa yalnız "Kartlarını telefona aktarmak için
  giriş yap" ve "Giriş yap" gösterir. Web'de misafir modu yok.
- **Web'de olmayanlar:** çalışma, sözlük, istatistik, zayıf kelimeler, hatırlatma. Giriş
  noktaları gizlenir (ana sayfa: "Tümünü çalış", seri satırı, zayıf şeridi, "İstatistikler";
  deste: "Çalış"; başlık: "Sözlük"; ana sayfa: "Ayarlar"). Rotalar `Stack.Protected` ile kapanır;
  doğrudan adres ana sayfaya döner. Hakkında'da sözlük kaynakları bölümü web'de yok.
- **Web'de kalanlar:** desteler, kartlar, toplu ekleme, Hesap, Hakkında.
- **Görünüm (28 Eki deneme bulgusu):** react-native-web'de `Appearance.setColorScheme` yok; web
  tarayıcının / sistemin temasını izler, "Koyu görünüm" anahtarı ve Ayarlar web'de yok. Görünüm
  tercihi web'de `localStorage`'da (expo-sqlite'ın eşzamanlı çağrısı worker hazır olmadan zaman
  aşımına düşüyordu).
- **Sunucu saati (deneme bulgusu):** tarayıcı, başka kökenin `Date` başlığını göstermez; sync saati
  `public.server_time()` RPC'sinden okur (migration `20261028120000`, prod'a uygulandı).
- **Satır içi düğme:** web'de `Pressable` `<button>`; `Row.accessory` satırın düğmesinin dışında.
- **Masaüstü:** içerik en fazla 640 px, ortalı.
- **Başlıklar:** `expo-sqlite` web'de `SharedArrayBuffer` için `Cross-Origin-Opener-Policy:
  same-origin`, `Cross-Origin-Embedder-Policy: require-corp`. Geliştirmede Metro ara katmanı,
  yayında Caddy (9b).
- **Web sürücüsü:** web'de `withExclusiveTransactionAsync` yok; `sqlDriver.web.ts` tüm sorguları
  tek sıraya alır, transaction `BEGIN IMMEDIATE … COMMIT`.

## Toplu ekleme

- Deste ekranında "Toplu ekle" (web ve telefon) → `/deck/[id]/bulk`.
- Satır = kart: `önyüz ; anlamlar ; İngilizce örnek ; Türkçe örnek`. Satırda sekme varsa ayraç
  sekme (Excel / Sheets), yoksa `;`. Anlamlar virgülle. Boş satır atlanır. Alanlar kırpılır.
- Önizleme (yazdıkça): "12 kart eklenecek · 2 satır hatalı · 1 kart zaten var".
  - Hatalı satır: önyüz ya da anlam yok → "3. satır: anlam yok" / "3. satır: önyüz yok".
  - Zaten var: herhangi bir destede aynı kart (`findDuplicate`) ya da metinde daha önceki
    satır → atlanır; "go · Fiiller destesinde" / "go · 2. satırla aynı".
- "N kartı ekle": yalnız geçerli ve yeni kartlar, `Library.createCard` ile; sonra deste ekranı.
  N = 0 iken düğme yok.

## Mimari

- Core `card/bulk.ts`: `parseBulk(text): BulkLine[]`, her satır `{ line, draft }` ya da
  `{ line, errors: CardError[] }`. `planBulk(lines, existing)` → eklenecek taslaklar,
  hatalı satırlar, tekrarlar (mevcut kart ya da önceki satır numarası; deste adını ekran
  bulur). Saf; Vitest.
- App `features/cards/BulkAddScreen.tsx` (ekran → `useLibrary`), rota `app/deck/[id]/bulk.tsx`.
- `ui/platform.ts`: `IS_WEB` (tek yerde `Platform.OS`).
- Sözlük paketi: `services/dictionaryPack.ts` / `.web.ts`.
- `ui/components` `Screen`: web'de `maxWidth` + ortalama.
- Metro: `server.enhanceMiddleware` ile COOP/COEP.

## Doğrulama sırası

1. Deneme: `expo start --web`, tarayıcıda giriş + deste oluşturma + telefona sync. Çalışmazsa
   dur, kullanıcıya bildir.
2. Toplu ekleme ve gizleme.

## Testler (önce başarısız test)

- Core: `parseBulk` (sekme, `;`, boş satır, eksik alan, virgüllü anlamlar, kırpma);
  `planBulk` (destedeki ve metindeki tekrar, hatalar, deste adı).
- App (Jest): toplu ekleme önizlemesi ve ekleme (yalnız yeni kartlar); web'de (`IS_WEB` mock)
  gizlenen girişler ve oturumsuz ana sayfa.
- Elle: tarayıcıda toplu ekleme → telefonda ≤10 sn görünür (plan bölüm 12).
