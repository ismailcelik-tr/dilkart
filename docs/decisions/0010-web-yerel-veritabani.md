# 0010 — Web'de de yerel veritabanı ve sync

Durum: Kabul (28 Eki 2026) · ADR 0001'deki "uzak repository" fikrinin yerine

**Bağlam:** Plan, web'in sunucuya doğrudan yazan bir "uzak repository" ile çalışacağını
öngörüyordu. Mobilde tüm veri katmanı `LocalStore` + sync üzerinde; sunucu tablolarına doğrudan
yazma Aşama 10'da kapanacak (ADR 0008). `expo-sqlite` web'de wa-sqlite'ı OPFS üzerinde çalıştırır.

**Karar:** Web, mobil ile aynı veri katmanını kullanır: tarayıcıda `expo-sqlite` (OPFS),
`LocalStore`, `Library`, `SyncService`. Web'de hesap zorunlu; sözlük paketi web'e girmez.

**Sonuçlar:** Kart düzenleme mantığı tek yerde; web ikinci kez yazılmaz; sonraki ziyaretlerde
yalnız değişiklik çekilir. Bedeli: `SharedArrayBuffer` için COOP/COEP başlıkları (Metro ve
Caddy); `expo-sqlite` web desteği mobildeki kadar olgun değil; OPFS gerektirir (güncel
Safari, Chrome, Firefox). Elenen: bellek içi veritabanı (her açılışta tam çekme), sunucu
tablolarına doğrudan yazma (ADR 0008 ile çelişir, mantık iki kez yazılır).
