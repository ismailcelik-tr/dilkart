# DilKart

Çevrimdışı çalışan İngilizce kelime kartları: aralıklı tekrar (FSRS) ve çalışma
ekranından ayrılmadan üç yönlü sözlük (EN→TR, TR→EN, EN→EN). iOS öncelikli;
kart yönetimi web'den de yapılabilir.

Durum: Aşama 0 (iskele). Plan: [docs/plan.md](docs/plan.md), kararlar:
[docs/decisions/](docs/decisions/).

## Yapı

| Dizin | İçerik |
|---|---|
| `apps/app` | Expo uygulaması (iOS, Android, statik web) |
| `packages/core` | Platformdan bağımsız iş kuralları (TypeScript) |
| `docs` | Plan, kararlar (ADR) |

## Geliştirme

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @dilkart/app ios
```

Gerekenler: Node 24+, pnpm, Xcode.

## Lisans

Kod: [MIT](LICENSE). Sözlük paketi (ileride): CC BY-SA 4.0, kaynak atıflarıyla
ayrıca yayınlanır.
