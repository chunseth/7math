begin;
create table mentalist.verification_reviews (
  profile uuid not null references public.profiles on delete cascade,
  grade smallint not null check (grade in (6, 7, 8)),
  bank_version integer not null check (bank_version > 0),
  case_id text not null,
  level_id text not null,
  question_id text not null,
  status text not null check (status in ('accepted', 'flagged')),
  note text,
  snapshot jsonb not null,
  saved_at timestamptz not null default clock_timestamp(),
  primary key (profile, grade, bank_version, case_id),
  check (
    (status = 'accepted' and note is null)
    or (status = 'flagged' and char_length(btrim(note)) between 1 and 1500 and note is not null)
  )
);
revoke all on mentalist.verification_reviews from public, anon, authenticated;
commit;
