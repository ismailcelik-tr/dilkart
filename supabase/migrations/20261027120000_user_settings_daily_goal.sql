-- Daily answer goal; 0 = off, null = app default (spec 2026-10-27).
alter table public.user_settings add column daily_goal smallint;
