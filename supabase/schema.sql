create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  username text unique,
  pin_code text,
  display_name text not null default 'Player',
  sprite_name text not null default 'raijin',
  level int not null default 1 check (level >= 1),
  xp int not null default 0 check (xp >= 0),
  coins int not null default 10000 check (coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[a-z0-9_]{3,16}$'),
  constraint pin_code_format check (pin_code is null or pin_code ~ '^[0-9]{2}$')
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists pin_code text;
alter table public.profiles add column if not exists sprite_name text not null default 'raijin';
alter table public.profiles alter column auth_user_id drop not null;
alter table public.profiles alter column coins set default 10000;
create unique index if not exists profiles_username_key on public.profiles (username);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'username_format'
  ) then
    alter table public.profiles
    add constraint username_format check (username is null or username ~ '^[a-z0-9_]{3,16}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'pin_code_format'
  ) then
    alter table public.profiles
    add constraint pin_code_format check (pin_code is null or pin_code ~ '^[0-9]{2}$');
  end if;
end;
$$;

create table if not exists public.student_progress (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  unlocked_numbers int[] not null default '{6,7,8,9}',
  selected_number int check (selected_number between 0 and 12),
  matches_played int not null default 0 check (matches_played >= 0),
  map_revealed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unlocked_numbers_in_range check (
    unlocked_numbers <@ array[0,1,2,3,4,5,6,7,8,9,10,11,12]
  )
);

create table if not exists public.chest_slots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  slot_index int not null check (slot_index between 0 and 3),
  state text not null default 'empty' check (state in ('empty','waiting','unlocking','ready','opened')),
  rarity text not null default 'common' check (rarity in ('common','rare','epic','legendary')),
  reward_type text check (reward_type in ('number','coins')),
  reward_number int check (reward_number between 0 and 12),
  reward_coins int check (reward_coins >= 0),
  earned_at timestamptz,
  unlock_started_at timestamptz,
  ready_at timestamptz,
  opened_at timestamptz,
  unique (profile_id, slot_index),
  constraint reward_payload_matches_type check (
    reward_type is null
    or (reward_type = 'number' and reward_number is not null and reward_coins is null)
    or (reward_type = 'coins' and reward_coins is not null and reward_number is null)
  )
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  selected_numbers int[] not null,
  correct_count int not null default 0 check (correct_count >= 0),
  incorrect_count int not null default 0 check (incorrect_count >= 0),
  duration_ms int check (duration_ms >= 0),
  xp_earned int not null default 0 check (xp_earned >= 0),
  coins_earned int not null default 0 check (coins_earned >= 0),
  chest_earned boolean not null default false,
  created_at timestamptz not null default now(),
  constraint selected_numbers_in_range check (
    selected_numbers <@ array[0,1,2,3,4,5,6,7,8,9,10,11,12]
  )
);

create table if not exists public.problem_attempts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  factor_a int not null check (factor_a between 0 and 12),
  factor_b int not null check (factor_b between 0 and 12),
  student_answer int,
  is_correct boolean not null,
  time_ms int check (time_ms >= 0),
  hints_used int not null default 0 check (hints_used >= 0),
  attempt_order int not null check (attempt_order >= 0),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists student_progress_set_updated_at on public.student_progress;
create trigger student_progress_set_updated_at
before update on public.student_progress
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.student_progress enable row level security;
alter table public.chest_slots enable row level security;
alter table public.matches enable row level security;
alter table public.problem_attempts enable row level security;

drop policy if exists "Students own profiles" on public.profiles;
drop policy if exists "Students can use username profiles" on public.profiles;
create policy "Students own profiles"
on public.profiles
for all
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "Students can use username profiles"
on public.profiles
for all
to anon
using (true)
with check (true);

drop policy if exists "Students own progress" on public.student_progress;
drop policy if exists "Students can use username progress" on public.student_progress;
create policy "Students own progress"
on public.student_progress
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = student_progress.profile_id
      and profiles.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = student_progress.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "Students can use username progress"
on public.student_progress
for all
to anon
using (true)
with check (true);

drop policy if exists "Students own chest slots" on public.chest_slots;
drop policy if exists "Students can use username chest slots" on public.chest_slots;
create policy "Students own chest slots"
on public.chest_slots
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = chest_slots.profile_id
      and profiles.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = chest_slots.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "Students can use username chest slots"
on public.chest_slots
for all
to anon
using (true)
with check (true);

drop policy if exists "Students own matches" on public.matches;
drop policy if exists "Students can use username matches" on public.matches;
create policy "Students own matches"
on public.matches
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = matches.profile_id
      and profiles.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = matches.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "Students can use username matches"
on public.matches
for all
to anon
using (true)
with check (true);

drop policy if exists "Students own problem attempts" on public.problem_attempts;
drop policy if exists "Students can use username problem attempts" on public.problem_attempts;
create policy "Students own problem attempts"
on public.problem_attempts
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = problem_attempts.profile_id
      and profiles.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = problem_attempts.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "Students can use username problem attempts"
on public.problem_attempts
for all
to anon
using (true)
with check (true);
