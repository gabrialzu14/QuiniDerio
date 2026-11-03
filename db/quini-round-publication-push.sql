-- Transactional publication outbox. Existing rounds are deliberately not backfilled.
create table public.quini_round_push_config (
 id boolean primary key default true check(id),
 dispatch_token text not null default (gen_random_uuid()::text || gen_random_uuid()::text)
);
insert into public.quini_round_push_config(id) values(true);
create table public.quini_round_push_events (
 round integer primary key check(round between 1 and 60),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create table public.quini_round_push_deliveries (
 id uuid primary key default gen_random_uuid(),
 round integer not null references public.quini_round_push_events(round),
 subscription_id bigint not null references public.push_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','accepted','expired')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,
 accepted_at timestamptz,
 last_error text,
 unique(round,subscription_id)
);
create index quini_round_push_pending_idx on public.quini_round_push_deliveries(next_attempt_at)
 where status in ('pending','processing');
alter table public.quini_round_push_config enable row level security;
alter table public.quini_round_push_events enable row level security;
alter table public.quini_round_push_deliveries enable row level security;
revoke all on public.quini_round_push_config,public.quini_round_push_events,public.quini_round_push_deliveries from public,anon,authenticated;
grant select on public.quini_round_push_config to service_role;
grant select,insert,update on public.quini_round_push_events,public.quini_round_push_deliveries to service_role;

create function public.quini_dispatch_round_push() returns bigint
 language plpgsql set search_path='' as $$
declare request_id bigint;
begin
 if not exists(select 1 from public.quini_round_push_deliveries d
 join public.quini_round_push_events e using(round)
 where d.status in ('pending','processing') and d.next_attempt_at<=now() and e.expires_at>now()) then
  return null;
 end if;
 select net.http_post(
  url:='https://quiniderio.vercel.app/api/push/publications',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization',
   'Bearer '||(select dispatch_token from public.quini_round_push_config where id)),
  body:='{}'::jsonb,timeout_milliseconds:=60000) into request_id;
 return request_id;
end $$;

create function public.quini_enqueue_round_push(p_round integer) returns void
 language plpgsql set search_path='' as $$
declare added integer;
begin
 insert into public.quini_round_push_events(round,expires_at)
 select p_round,least(now()+interval '7 days',min(scheduled_at))
 from public.quini_live_matches where round=p_round
 having count(*)>0
 on conflict(round) do nothing;
 get diagnostics added=row_count;
 if added=0 then return; end if;
 insert into public.quini_round_push_deliveries(round,subscription_id)
 select p_round,id from public.push_subscriptions where enabled
 on conflict do nothing;
 -- pg_net dispatches only after this publication transaction commits.
 -- A transport failure must not roll back an otherwise valid publication.
 begin
  perform public.quini_dispatch_round_push();
 exception when others then
  raise warning 'Round push queued for scheduled retry';
 end;
end $$;

create function public.quini_claim_round_push() returns table(
 delivery_id uuid,round integer,subscription_id bigint,player_id uuid,
 endpoint text,p256dh text,auth text,lease_token uuid,attempts integer
) language sql set search_path='' as $$
 with candidates as (
  select d.id from public.quini_round_push_deliveries d
  join public.quini_round_push_events e on e.round=d.round
  where d.status in ('pending','processing') and d.next_attempt_at<=now() and e.expires_at>now()
  order by d.next_attempt_at,d.id for update of d skip locked limit 20
 ), claimed as (
  update public.quini_round_push_deliveries d
  set status='processing',attempts=d.attempts+1,next_attempt_at=now()+interval '5 minutes',lease_token=gen_random_uuid()
  from candidates c where d.id=c.id returning d.*
 )
 select c.id,c.round,c.subscription_id,s.player_id,s.endpoint,s.p256dh,s.auth,c.lease_token,c.attempts
 from claimed c join public.push_subscriptions s on s.id=c.subscription_id;
$$;
revoke all on function public.quini_dispatch_round_push(),public.quini_enqueue_round_push(integer),public.quini_claim_round_push() from public,anon,authenticated;
grant execute on function public.quini_dispatch_round_push(),public.quini_enqueue_round_push(integer),public.quini_claim_round_push() to service_role;

-- Preserve the existing validated publication and activation logic verbatim.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.quini_publish_round(integer,jsonb)'::regprocedure) into definition;
 if position('quini_enqueue_round_push' in definition)=0 then
  if position('  RETURN n;' in definition)=0 then raise exception 'Unexpected publication function'; end if;
  execute replace(definition,'  RETURN n;',E'  PERFORM public.quini_enqueue_round_push(p_round);\n  RETURN n;');
 end if;
end $$;
select cron.schedule('quini-round-publication-push','* * * * *','select public.quini_dispatch_round_push();');
