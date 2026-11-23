begin;
create table mentalist.rush_runs (
  id uuid primary key,
  profile uuid not null references public.profiles on delete cascade,
  started timestamptz not null default clock_timestamp(),
  questions jsonb,
  score int check (score between 0 and 12),
  elapsed_ms int check (elapsed_ms >= 0),
  check (
    (questions is not null and jsonb_array_length(questions) = 12 and score is null and elapsed_ms is null)
    or (questions is null and score is not null and elapsed_ms is not null)
  )
);
create index rush_completed_runs on mentalist.rush_runs(profile, score desc, elapsed_ms) where score is not null;
create index rush_pending_runs on mentalist.rush_runs(profile, started) where score is null;
revoke all on mentalist.rush_runs from public, anon, authenticated;
commit;
