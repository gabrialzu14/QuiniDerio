-- Admin-only push reminder audit. No policies for public clients.
-- Delivery cannot be confirmed by web-push, only provider acceptance.
create table if not exists public.quini_push_reminder_reports (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null,
 round integer not null check (round > 0),
 user_id uuid not null,
 username text not null,
 status text not null check (status in ('processing','accepted','failed','no_subscription','unknown')),
 reason text,
 accepted_devices integer not null default 0 check (accepted_devices >= 0),
 failed_devices integer not null default 0 check (failed_devices >= 0),
 created_at timestamptz not null default now(),
 unique (request_id,user_id)
);
create index if not exists quini_push_reports_round_created_idx
 on public.quini_push_reminder_reports (round,created_at desc);
alter table public.quini_push_reminder_reports enable row level security;
revoke all on table public.quini_push_reminder_reports from anon,authenticated;
grant select,insert,update on table public.quini_push_reminder_reports to service_role;
