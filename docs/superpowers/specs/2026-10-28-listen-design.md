# "Dinle" düğmeleri (kart listesi, çalışma örneği, sözlük)

Tarih: 28 Eki 2026 · Durum: onaylandı

## Amaç

İngilizce kelime ve cümleyi, çalışma oturumu açmadan, gördüğün yerde dinleyebilmek.

## Kurallar

- Yalnız İngilizce metin okunur; mevcut `useSpeech` (aksan ayarı, sessiz modda da çalar).
- Cihazda İngilizce ses yoksa (`speech.available !== true`) hiçbir hoparlör görünmez.
- Görünüm: küçük hoparlör simgesi (SF Symbol `speaker.wave.2.fill`), erişilebilirlik etiketi
  `Dinle: <metin>`.
- Önyüzdeki mevcut "Dinle" ve "Tekrar dinle" düğmeleri değişmez.
- **Reddedilen:** kart düzenleme ekranında örnek alanının yanında hoparlör (ekran yazmak için).

## Yerler

| Ekran | Nerede | Okunan |
|---|---|---|
| Kart listesi (deste) | her satırın sağı | kartın önyüzü |
| Çalışma, "Cevabı göster"den sonra | İngilizce örnek cümlenin yanı | `exampleEn` |
| Sözlük EN→TR, EN→EN | başlık kelimenin yanı | başlık |
| Sözlük TR→EN | her anlam satırının yanı (İngilizce karşılık) | `gloss` |
| Sözlük, her yön | her örneğin yanı | örneğin yalnız İngilizce kısmı |

Kart satırına dokunmak eskisi gibi düzenlemeyi açar; hoparlöre dokunmak yalnız okur.

## Mimari

- `ui/components.tsx`: `IconButton({ icon, label, onPress })` (`SymbolView`, `hitSlop`); `Row`'a
  isteğe bağlı `accessory?: ReactNode` (✓'nin yerinde, sağda).
- `useSpeech` her ekranda bir kez çağrılır (`CardList`, `RecallCard`, `DictionaryScreen`);
  satırlara `speak` / `available` geçer. Liste satırı başına ses listesi yüklenmez.
- Sözlükte yön `Entry`'ye geçer; başlık mı karşılık mı okunacağı yöne göre.
- Core ve sunucu değişmez.

## Testler (önce başarısız test, Jest; `expo-speech` mock'lu)

- Kart listesi: hoparlör önyüzü okur; düzenleme ekranı açılmaz.
- Çalışma: cevaptan sonra örnek cümle okunur.
- Sözlük EN→TR: başlık okunur ("book"); örnekte yalnız İngilizce ("This book is mine.").
- Sözlük TR→EN: başlıkta hoparlör yok; karşılık okunur ("book").
- Ses yokken hiçbir `Dinle:` etiketi görünmez.

Cihaz: release build'de denenir; onaydan sonra commit + push.
