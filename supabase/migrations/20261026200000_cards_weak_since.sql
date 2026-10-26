-- When a card was marked weak; recovery counts answers after it (spec 2026-10-26).
alter table public.cards add column weak_since timestamptz;
