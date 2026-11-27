begin;

create table mentalist.rivals_matches (
  id uuid primary key,
  grade smallint not null check (grade in (6, 7, 8)),
  starts_at timestamptz not null,
  questions jsonb,
  reason text check (reason in ('finished', 'forfeit', 'deadline', 'abandoned')),
  winner uuid,
  check (
    (reason is null and questions is not null and jsonb_array_length(questions) = 12 and winner is null)
    or (reason is not null and questions is null)
  )
);

create table mentalist.rivals_entries (
  profile uuid primary key references public.profiles on delete cascade,
  grade smallint not null check (grade in (6, 7, 8)),
  ticket uuid,
  queued_at timestamptz,
  last_seen timestamptz not null,
  match uuid references mentalist.rivals_matches on delete cascade,
  check ((ticket is null) = (queued_at is null)),
  check (ticket is null or match is null)
);
create index rivals_waiting on mentalist.rivals_entries(grade, queued_at, profile) where ticket is not null;

create table mentalist.rivals_players (
  match uuid references mentalist.rivals_matches on delete cascade,
  -- Keep the participant snapshot if a profile is deleted during the race.
  profile uuid not null,
  username text not null,
  last_seen timestamptz not null,
  resolved smallint not null default 0 check (resolved between 0 and 12),
  mistakes smallint not null default 0 check (mistakes between 0 and resolved),
  finished_ms integer check (finished_ms >= 0),
  primary key (match, profile),
  check ((resolved = 12) = (finished_ms is not null))
);

create table mentalist.rivals_answers (
  match uuid,
  profile uuid,
  id uuid,
  question smallint not null check (question between 0 and 11),
  payload_hash text not null,
  outcome text not null check (outcome in ('correct', 'incorrect', 'simplification')),
  primary key (match, profile, id),
  foreign key (match, profile) references mentalist.rivals_players on delete cascade
);

revoke all on mentalist.rivals_matches, mentalist.rivals_entries, mentalist.rivals_players,
  mentalist.rivals_answers from public, anon, authenticated;

commit;
