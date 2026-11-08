-- Log of federation sync runs (also used to space runs at least 10 minutes apart).
create table if not exists public.quini_federation_sync_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  summary jsonb
);
create index if not exists quini_federation_sync_runs_started_idx on public.quini_federation_sync_runs (started_at desc);
-- Only the service role (the sync function) reads and writes it.
alter table public.quini_federation_sync_runs enable row level security;
