-- QuiniDerio: the Derio A prediction slot passes from Nando to Aner.
-- Idempotent data update. Results, disciplinary history, picks and points are untouched.
begin;

update public.teams set coach = 'Aner Blanco'
where id = 'derio-a' and coach = 'Nando Alonso';

update public.quini_profiles
set season = season ||
  case when season->>'firstCoach' = 'Nando Alonso'
    then jsonb_build_object('firstCoach', 'Aner Blanco') else '{}'::jsonb end ||
  case when season->>'coachCards' = 'Nando Alonso'
    then jsonb_build_object('coachCards', 'Aner Blanco') else '{}'::jsonb end
where season->>'firstCoach' = 'Nando Alonso' or season->>'coachCards' = 'Nando Alonso';

-- Keep the older prediction format consistent if it is used again.
update public.season_predictions
set first_coach_sent_off = case when first_coach_sent_off = 'Nando Alonso' then 'Aner Blanco' else first_coach_sent_off end,
    coach_most_cards = case when coach_most_cards = 'Nando Alonso' then 'Aner Blanco' else coach_most_cards end
where first_coach_sent_off = 'Nando Alonso' or coach_most_cards = 'Nando Alonso';

commit;
