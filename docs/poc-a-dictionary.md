# PoC-A: çevrimdışı üç yönlü sözlük

Tarih: 24 Eki 2026. Kod: `tools/dictionary` (ETL), `packages/core/src/dictionary` (arama),
`apps/app/src/app/dev/dictionary-bench.tsx` (cihaz ölçümü; 28 Eki'de kaldırıldı, git geçmişinde).

## Kaynaklar

| Kaynak | Sürüm | Kullanım | Lisans |
|---|---|---|---|
| Vikisözlük (kaikki tr-extract) | dump 2026-10-02 | EN→TR karşılıklar | CC BY-SA 4.0 + GFDL |
| İngilizce Vikisözlük (kaikki raw) | dump 2026-10-01 | TR→EN, EN→TR çeviri tabloları, çekim formları | CC BY-SA 4.0 + GFDL |
| Open English WordNet | 2025 | EN→EN tanım, eş/zıt anlam, örnek | CC BY 4.0 |
| Tatoeba | haftalık dışa aktarım | EN↔TR örnek cümle (≤80 karakter) | CC BY 2.0 FR |
| wordfreq | 3.1.1 | yalnız ölçüm (pakete girmez) | Apache-2.0 |

Yeniden üretme: `tools/dictionary` içinde `extract` (iki dump) → `cli` (paket) → `report`.

## Sonuçlar ve plan eşikleri

| Ölçüt | Eşik | Sonuç | Durum |
|---|---|---|---|
| Paket boyutu | ≤150 MB gömülü | 97,0 MB (gzip 51 MB) | ✅ |
| EN→TR kapsam (en sık 10k İngilizce kelime biçimi) | ≥%90 | %96,2 | ✅ |
| TR→EN kapsam (en sık 5k Türkçe kelime biçimi) | ≥%85 | %98,4 | ✅ (aşağıdaki not) |
| EN→EN kapsam | — | %92,0 (eksikler: the, to, and… işlev kelimeleri) | ⚠️ |
| Örnek cümleli girdi | ≥%60 | %96–98 | ✅ |
| Altın küme, ilk 3 sonuçta doğru (EN→TR / TR→EN / EN→EN) | ≥%95 | 100/100, 100/100, 59/59 | ✅ (aşağıdaki not) |
| Arama p95, Mac (Python) | — | tam ≤0,3 ms, önek ≤2 ms | ✅ |
| Arama p95, iOS simülatör (Hermes + expo-sqlite) | ≤100 ms | tam ≤3,6 ms, önek ≤15 ms | ✅ |
| Arama p95, gerçek iPhone (Expo Go, 25 Eki) | ≤100 ms | tam ≤3,9 ms, önek ≤17,1 ms | ✅ |

Notlar:
- Altın kümeyi aynı kişi yazdı ve iki cevap ("kapamak", "en route") doğru oldukları için
  genişletildi; bağımsız değil. Asıl güvence sıklık listesi kapsamı.
- TR→EN kapsamının ~%30'u sorgu anı kök bulmayla geliyor. 40'lık örneklemde düzeltmelerden
  önce ~%65–80 isabet ölçüldü; ünsüz yumuşaması, `-yor`/geçmiş zaman fiil kuralı, özel isim
  dışlama ve Türkçe harf önceliği sonrası altın kümedeki 40 çekimli kelimenin hepsi doğru.
  Belirsiz durumlar kalıyor: `ayında → ayı`, `verilen → veri`, `deyince → deyin`.

## Tasarım kararları (ölçümle verildi)

- **Türkçe çekim tabloları pakete girmez:** 2,57 M satır / 66 MB idi. Yerine sorgu anında
  kök bulma (`stem.py` / `stem.ts`): uzundan kısaya kırpma, ünsüz yumuşaması geri çevirme,
  `-mek/-mak` ekleme, `-yor` ve geçmiş zamanda önce fiil kökü. Aynı uzunluktaki tüm
  adaylar döner (`kurulması → kurul, kurulmak`).
- **Kimlikler 52 bit hash, satır kimliği olarak:** ayrı unique indeksler (21 MB) kalktı;
  JS'te kayıpsız; kart `entry_id`/`sense_id` saklar, sözlük güncellense de değişmez
  (başlık + tür + karşılık metni aynı kaldıkça).
- **Anlam sırası kaynak sırası:** sıklığa göre sıralama denendi, `run → kaçmak`,
  `tutmak → like` ürettiği için geri alındı. Kısa karşılıklar uzun tanımların önüne alınır;
  tanım sonundaki kısa karşılık ayrıca çıkarılır ("…sonra gerçekleşen, geç" → "geç").
- **Ters çeviri:** iki yönün kısa (≤3 kelime) karşılıkları birbirini besler; EN→TR
  kapsamını %92,3'ten %96,2'ye çıkardı.
- **Python ve TypeScript aynı davranır:** `spec/*.json` vektörleri ve
  `spec/fixtures/dictionary.sqlite` üzerinde iki tarafta da aynı sözleşme testleri.

## Bilinen eksikler

Aşama 6'da kapatılanlar (25 Eki 2026; paket 97,0 → 106,5 MB, şema sürümü 2):
- `-ly` zarfları sıfat köküne düşer (`gently → gentle`, `basically → basic`); EN→TR kapsam %96,8.
- EN→EN: WordNet'te olmayan kelimelere İngilizce Vikisözlük tanımları (en çok 3); kapsam %92,0 → %98,9.
  Kaynaklar sözcük türüne farklı ad verebildiği için (`the`: Vikisözlük "particle", Wiktionary
  "article") eşleşme kelime düzeyine de düşer.
- Girdi sırası İngilizce Vikisözlük sayfa sırasıyla (`entries.rank`): `go` → fiil, `book` → isim.

Kalan:
- Paket açılışı: simülatörde 105 ms (asset kopyası dahil); gerçek cihazda gömülü kopya
  release build'de ölçülmeli (Aşama 11).
- Atıf ekranı Aşama 6'da.

## Karar

Kaynak ve yaklaşım tüm eşikleri karşılıyor; gerçek iPhone'da p95 ≤17,1 ms. ADR 0004
"Kabul"; sözlük uygulamayla gömülü gelir.
