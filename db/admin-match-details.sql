-- Additive migration: existing match identity, scores and predictions stay intact.
alter table public.quini_live_matches add column if not exists fixture_details jsonb;
alter table public.quini_live_matches add constraint quini_live_matches_fixture_details_object check (fixture_details is null or jsonb_typeof(fixture_details) = 'object');
