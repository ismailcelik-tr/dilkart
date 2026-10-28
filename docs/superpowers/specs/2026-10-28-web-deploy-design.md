# Web'in Fly'da yayını (Aşama 9b)

Tarih: 28 Eki 2026 · Durum: onaylandı

## Kararlar

- **Adres:** Fly uygulaması `dilkart`, https://dilkart.fly.dev; hesap `dilkartapp@gmail.com`; bölge `fra`.
- **İmaj** (`infra/web/Dockerfile`): Node 24 aşamasında `pnpm install --filter @dilkart/app...` ve
  `expo export -p web`; Caddy aşaması `/srv`. Supabase URL ve publishable key build argümanı
  (`fly.toml`, herkese açık; zaten tarayıcı paketinde).
- **Çıktı `single` (SPA):** `static` her rotayı derlemede Node'da çiziyordu (iOS çarkı kırdı) ve
  dinamik rotalar için ayrı yönlendirme isterdi; web giriş arkasında, SEO gerekmez. ADR 0001'deki
  `static` bu yüzden `single`.
- **Caddy** (`infra/web/Caddyfile`): `/healthz`; SPA fallback (`try_files {path} /index.html`);
  zstd/gzip; COOP/COEP (ADR 0010), HSTS, CSP (`wasm-unsafe-eval` wa-sqlite için, `worker-src blob:`
  expo-sqlite worker'ı için, satır içi stil react-native-web için, `connect-src` yalnız Supabase); hash'li paketler bir yıl, sayfa `no-cache`.
- **`fly.toml`:** `shared-cpu-1x`, 256 MB, `auto_stop_machines = "stop"`, `min_machines_running = 0`,
  `/healthz` kontrolü, paylaşımlı IPv4.
- **Dağıtım** (`.github/workflows/deploy-web.yml`): `main`'de CI başarılı olunca
  `flyctl deploy --remote-only`; token repo secret'ı `FLY_API_TOKEN` (deploy kapsamlı, 1 yıl: 28 Eki 2027'de yenilenir).
- **Kaldırılan:** `dev/dictionary-bench` (PoC-A ölçümü; git dışı `bench.json` istediği için
  temiz checkout'ta web derlemesini kırıyordu, karar kapısından sonra kalkacaktı).

## Doğrulama

- Yerel: `docker build` + `docker run -p 8080:8080`; `/healthz` "ok", `/deck/x` → sayfa, başlıklar.
- Tarayıcıda http://localhost:8080 ve sonra https://dilkart.fly.dev: giriş, toplu ekleme, sync;
  konsolda CSP ihlali yok.
- Push sonrası Actions'ta deploy işi yeşil.
