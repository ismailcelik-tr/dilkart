# Web: Expo export, served by Caddy (ADR 0006). Build context is the repo root.
FROM node:24-slim AS build
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/app/package.json apps/app/
COPY packages/core/package.json packages/core/
COPY tools/sync-harness/package.json tools/sync-harness/
RUN pnpm install --frozen-lockfile --filter @dilkart/app...

COPY packages/core packages/core
COPY apps/app apps/app
# Public values: they end up in the browser bundle anyway.
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_KEY
RUN cd apps/app && npx expo export -p web --output-dir /dist

FROM caddy:2-alpine
COPY infra/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /dist /srv
