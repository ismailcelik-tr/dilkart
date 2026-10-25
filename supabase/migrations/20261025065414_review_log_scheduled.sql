-- False for practice (match module, free or weak-word session, re-study of a
-- card not yet due on the same day); FSRS replay skips those logs.
alter table public.review_logs add column scheduled boolean not null default true;
