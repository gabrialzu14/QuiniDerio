-- Penalización de 3 € por no realizar la quiniela de una jornada (con algún partido terminado).
-- Exentos: KOLDO e Ibisaur en la jornada 1. Aplicado en Supabase como migración pot_no_play_penalty.
create table if not exists public.quini_pot_exemptions(user_id uuid not null references public.quini_profiles(user_id) on delete cascade, round int not null, reason text, primary key(user_id,round));
alter table public.quini_pot_exemptions enable row level security;
create policy "pot exemptions readable" on public.quini_pot_exemptions for select using (true);
-- La vista quini_pot_standings suma 3 € por cada jornada sin pronósticos y sin exención.
