begin;
create table mentalist.verification_set_decisions (
  profile uuid not null references public.profiles on delete cascade,
  review_set_id text not null,
  case_id text not null,
  grade smallint not null check (grade in (6, 7, 8)),
  bank_version integer not null check (bank_version > 0),
  level_id text not null,
  question_id text not null,
  status text not null check (status in ('accepted', 'flagged', 'skipped')),
  note text,
  snapshot jsonb not null,
  saved_at timestamptz not null default clock_timestamp(),
  primary key (profile, review_set_id, case_id),
  check (
    (status in ('accepted', 'skipped') and note is null)
    or (status = 'flagged' and note is not null and char_length(btrim(note)) between 1 and 1500)
  )
);
revoke all on mentalist.verification_set_decisions from public, anon, authenticated;
commit;
