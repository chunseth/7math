begin;

create table mentalist.mining_expeditions (
  id uuid primary key,
  profile uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('active', 'returned', 'passed_out')),
  state jsonb,
  summary jsonb,
  deepest_floor integer not null check (deepest_floor >= 1),
  started_at timestamptz not null,
  ended_at timestamptz,
  constraint mining_expedition_lifecycle check (
    (status = 'active' and state is not null and summary is null and ended_at is null) or
    (status <> 'active' and state is null and summary is not null and ended_at is not null)
  )
);
create unique index mining_one_active_expedition on mentalist.mining_expeditions(profile) where status = 'active';
create index mining_expedition_history on mentalist.mining_expeditions(profile, ended_at desc, id) where ended_at is not null;

create table mentalist.mining_rock_stats (
  profile uuid not null references public.profiles(id) on delete cascade,
  rock text not null,
  history jsonb not null,
  primary key (profile, rock)
);

create table mentalist.mining_events (
  id bigint generated always as identity primary key,
  profile uuid not null references public.profiles(id) on delete cascade,
  expedition uuid references mentalist.mining_expeditions(id) on delete cascade,
  kind text not null check (kind in ('start', 'swing', 'descend', 'return', 'catalogue')),
  occurred_at timestamptz not null,
  details jsonb not null
);
create index mining_events_by_expedition on mentalist.mining_events(expedition, id);
create index mining_events_by_player on mentalist.mining_events(profile, occurred_at);

revoke all on mentalist.mining_expeditions, mentalist.mining_rock_stats, mentalist.mining_events from public, anon, authenticated;
revoke all on sequence mentalist.mining_events_id_seq from public, anon, authenticated;

commit;
