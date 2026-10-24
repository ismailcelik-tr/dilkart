# 0004 — Açık lisanslı, cihazda çalışan sözlük paketi

Durum: Öneri (24 Eki 2026), PoC-A eşikleriyle kesinleşecek

**Karar:** Vikisözlük (EN→TR), İngilizce Vikisözlük (TR→EN, çeviri ve çekim
tabloları), Open English WordNet (EN→EN), Tatoeba (örnek cümle); wiktextract/kaikki
çıktılarından Python ETL ile tek `dictionary.sqlite`. Kullanıcı verisinden ayrı dosya.

**Sonuçlar:** Paket CC BY-SA 4.0; GitHub Releases'te açık yayınlanır; uygulamada
atıf ekranı. Elenen: FreeDict (küçük, GPL), ticari sözlükler (lisans yok).
