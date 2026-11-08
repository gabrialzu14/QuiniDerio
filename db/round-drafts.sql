-- Federation-prepared draft of the next jornada; the admin reviews it in "Crear jornada" and publishes.
create table if not exists public.quini_round_drafts (
  round integer primary key,
  games jsonb not null,
  notes jsonb not null default '[]'::jsonb,
  source text not null default 'federation',
  updated_at timestamptz not null default now()
);
alter table public.quini_round_drafts enable row level security;
-- Only the QuiniDerio admin can read drafts; writes come from the weekly load.
create policy "admin reads round drafts" on public.quini_round_drafts
  for select to authenticated
  using (lower(coalesce(auth.jwt()->>'email','')) = 'gabrialzueta@gmail.com');
