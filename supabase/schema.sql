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

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default 'Teacher',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Teacher accounts are intentionally provisioned by an administrator instead
-- of through public sign-up. After creating the user in Supabase Auth, run:
--
-- insert into public.teachers (auth_user_id, email, display_name)
-- select id, email, 'Teacher Name'
-- from auth.users
-- where email = 'teacher@example.com'
-- on conflict (auth_user_id) do update
-- set email = excluded.email, display_name = excluded.display_name, is_active = true;

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
  unlocked_numbers int[] not null default '{3,4,5,6}',
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
  reward_type text check (reward_type in ('number','coins','cards')),
  reward_number int check (reward_number between 0 and 12),
  reward_coins int check (reward_coins >= 0),
  reward_card_count int check (reward_card_count is null or reward_card_count >= 0),
  earned_at timestamptz,
  unlock_started_at timestamptz,
  ready_at timestamptz,
  opened_at timestamptz,
  unique (profile_id, slot_index),
  constraint reward_payload_matches_type check (
    reward_type is null
    -- new number unlock: unlocks the number and grants 1 card
    or (reward_type = 'number' and reward_number is not null and reward_coins is null)
    -- already-owned number: grants a stack of cards (20) for that number
    or (reward_type = 'cards' and reward_number is not null and reward_card_count is not null and reward_coins is null)
    or (reward_type = 'coins' and reward_coins is not null and reward_number is null and reward_card_count is null)
  )
);

-- Migrate existing chest_slots tables to the card-reward model.
alter table public.chest_slots add column if not exists reward_card_count int;
alter table public.chest_slots drop constraint if exists chest_slots_reward_type_check;
alter table public.chest_slots drop constraint if exists reward_payload_matches_type;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chest_slots_reward_type_check') then
    alter table public.chest_slots
      add constraint chest_slots_reward_type_check check (reward_type in ('number','coins','cards'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chest_slots_reward_card_count_check') then
    alter table public.chest_slots
      add constraint chest_slots_reward_card_count_check check (reward_card_count is null or reward_card_count >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reward_payload_matches_type') then
    alter table public.chest_slots
      add constraint reward_payload_matches_type check (
        reward_type is null
        or (reward_type = 'number' and reward_number is not null and reward_coins is null)
        or (reward_type = 'cards' and reward_number is not null and reward_card_count is not null and reward_coins is null)
        or (reward_type = 'coins' and reward_coins is not null and reward_number is null and reward_card_count is null)
      );
  end if;
end;
$$;

-- Per-number card collection and level. Cards are earned from correct answers
-- and chests; a number levels up at 40 cards + 2,000 coins, capped at level 4.
-- Card stacks can overflow the upgrade cost and are hard-capped at 999.
create table if not exists public.number_cards (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  number int not null check (number between 0 and 12),
  card_count int not null default 0 check (card_count >= 0 and card_count <= 999),
  level int not null default 1 check (level between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, number)
);

-- Operation-neutral collection. Existing multiplication rows are migrated below;
-- addition, subtraction, and division use concept IDs such as addition.single-digit.
create table if not exists public.skill_cards (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id text not null,
  operation text not null check (operation in ('multiplication','addition','subtraction','division')),
  card_count int not null default 0 check (card_count >= 0 and card_count <= 999),
  level int not null default 1 check (level between 1 and 4),
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, skill_id)
);

-- Existing deployments created this check with only multiplication and addition.
alter table public.skill_cards drop constraint if exists skill_cards_operation_check;
alter table public.skill_cards
  add constraint skill_cards_operation_check check (operation in ('multiplication','addition','subtraction','division'));

insert into public.skill_cards (profile_id, skill_id, operation, card_count, level, unlocked_at)
select profile_id, 'multiplication.row.' || number, 'multiplication', card_count, level, created_at
from public.number_cards
on conflict (profile_id, skill_id) do update
set card_count = excluded.card_count, level = excluded.level;

insert into public.skill_cards (profile_id, skill_id, operation, card_count, level)
select id, 'addition.single-digit', 'addition', 0, 1
from public.profiles
on conflict (profile_id, skill_id) do nothing;

insert into public.skill_cards (profile_id, skill_id, operation, card_count, level)
select id, 'subtraction.within-ten', 'subtraction', 0, 1
from public.profiles
on conflict (profile_id, skill_id) do nothing;

-- Division mirrors multiplication's row cards. Divisors 1–12 are shown in the
-- collection. Zero stays hidden from the division map and permanently at level 1.
insert into public.skill_cards (profile_id, skill_id, operation, card_count, level)
select profiles.id, 'division.row.' || divisors.number, 'division', 0, 1
from public.profiles
cross join generate_series(0, 12) as divisors(number)
on conflict (profile_id, skill_id) do nothing;

alter table public.skill_cards drop constraint if exists skill_cards_division_zero_level_check;
alter table public.skill_cards add constraint skill_cards_division_zero_level_check
  check (skill_id <> 'division.row.0' or level = 1);

alter table public.number_cards drop constraint if exists number_cards_card_count_check;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'number_cards_card_count_check') then
    alter table public.number_cards
      add constraint number_cards_card_count_check check (card_count >= 0 and card_count <= 999);
  end if;
end;
$$;

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

alter table public.matches
add column if not exists operations text[] not null default '{multiplication}';

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

-- General equation persistence. Legacy factor columns remain during migration so
-- old deployments can be upgraded without losing history.
alter table public.problem_attempts add column if not exists operation text;
alter table public.problem_attempts add column if not exists skill_id text;
alter table public.problem_attempts add column if not exists operand_a int;
alter table public.problem_attempts add column if not exists operand_b int;
alter table public.problem_attempts add column if not exists operand_c int;
alter table public.problem_attempts add column if not exists expected_answer int;

update public.problem_attempts
set operation = coalesce(operation, 'multiplication'),
    skill_id = coalesce(skill_id, 'multiplication.row.' || factor_a),
    operand_a = coalesce(operand_a, factor_a),
    operand_b = coalesce(operand_b, factor_b),
    expected_answer = coalesce(expected_answer, factor_a * factor_b)
where operation is null or skill_id is null or operand_a is null or operand_b is null or expected_answer is null;

alter table public.problem_attempts alter column operation set not null;
alter table public.problem_attempts alter column skill_id set not null;
alter table public.problem_attempts alter column operand_a set not null;
alter table public.problem_attempts alter column operand_b set not null;
alter table public.problem_attempts alter column expected_answer set not null;
alter table public.problem_attempts alter column factor_a drop not null;
alter table public.problem_attempts alter column factor_b drop not null;

alter table public.problem_attempts drop constraint if exists problem_attempts_operation_check;
alter table public.problem_attempts
  add constraint problem_attempts_operation_check check (operation in ('multiplication','addition','subtraction','division'));

-- Carried-over speed profile, one row per (student, arena). The battle loop
-- reads carry_milestone_id at match start so the clock opens where the student
-- left off (softened one tier) instead of resetting to Warmup every match.
create table if not exists public.arena_speed_profiles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  arena_id text not null,
  -- Milestone the student ended their last battle on.
  ending_milestone_id text not null default 'warmup',
  -- Milestone the next battle in this arena opens on (ending, softened one tier).
  carry_milestone_id text not null default 'warmup',
  carry_multiplier numeric(4,3) not null default 1.0 check (carry_multiplier > 0 and carry_multiplier <= 1),
  -- Rolling aggregates over battles in this arena, for trend display.
  battles_recorded int not null default 0 check (battles_recorded >= 0),
  last_fast_rate numeric(4,3) not null default 0 check (last_fast_rate between 0 and 1),
  last_accuracy numeric(4,3) not null default 0 check (last_accuracy between 0 and 1),
  last_median_time_seconds numeric(6,2) not null default 0 check (last_median_time_seconds >= 0),
  last_battle_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, arena_id)
);

alter table public.arena_speed_profiles drop constraint if exists arena_speed_profiles_arena_id_check;

-- One row per finished battle: the queryable speed history behind the trend.
create table if not exists public.match_speed_stats (
  match_id uuid primary key references public.matches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  arena_id text not null,
  -- Milestone the battle opened on (carried in) and ended on.
  starting_milestone_id text not null default 'warmup',
  ending_milestone_id text not null default 'warmup',
  carry_milestone_id text not null default 'warmup',
  attempts int not null default 0 check (attempts >= 0),
  correct_count int not null default 0 check (correct_count >= 0),
  accuracy numeric(4,3) not null default 0 check (accuracy between 0 and 1),
  fast_count int not null default 0 check (fast_count >= 0),
  fast_rate numeric(4,3) not null default 0 check (fast_rate between 0 and 1),
  median_time_seconds numeric(6,2) not null default 0 check (median_time_seconds >= 0),
  -- Mean fraction of the allotted clock the student actually used.
  average_clock_used numeric(5,3) not null default 0 check (average_clock_used >= 0),
  created_at timestamptz not null default now()
);

create index if not exists match_speed_stats_profile_created_at_idx
on public.match_speed_stats (profile_id, created_at desc);

create index if not exists match_speed_stats_profile_arena_idx
on public.match_speed_stats (profile_id, arena_id, created_at desc);

-- A chest can contain coins, multiple card stacks, and at most one unlock.
create table if not exists public.chest_rewards (
  id uuid primary key default gen_random_uuid(),
  chest_id uuid not null references public.chest_slots(id) on delete cascade,
  reward_order int not null check (reward_order >= 0),
  reward_type text not null check (reward_type in ('coins','cards','unlock')),
  operation text check (operation in ('multiplication','addition','subtraction','division')),
  skill_id text,
  coin_amount int check (coin_amount is null or coin_amount >= 0),
  card_amount int check (card_amount is null or card_amount >= 0),
  source_match_id uuid references public.matches(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (chest_id, reward_order),
  constraint chest_reward_payload_check check (
    (reward_type = 'coins' and coin_amount is not null and skill_id is null and card_amount is null)
    or (reward_type = 'cards' and skill_id is not null and operation is not null and card_amount is not null and coin_amount is null)
    or (reward_type = 'unlock' and skill_id is not null and operation is not null and coin_amount is null and card_amount is null)
  )
);

alter table public.chest_rewards drop constraint if exists chest_rewards_operation_check;
alter table public.chest_rewards
  add constraint chest_rewards_operation_check check (operation in ('multiplication','addition','subtraction','division'));

create index if not exists problem_attempts_profile_created_at_idx
on public.problem_attempts (profile_id, created_at desc);

create index if not exists problem_attempts_match_order_idx
on public.problem_attempts (match_id, attempt_order);

create index if not exists matches_profile_created_at_idx
on public.matches (profile_id, created_at desc);

-- Power the teacher dashboard's live match and answer feed. The guarded block
-- makes this schema safe to run again after the tables join the publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'problem_attempts'
  ) then
    alter publication supabase_realtime add table public.problem_attempts;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;

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

drop trigger if exists teachers_set_updated_at on public.teachers;
create trigger teachers_set_updated_at
before update on public.teachers
for each row execute function public.set_updated_at();

drop trigger if exists student_progress_set_updated_at on public.student_progress;
create trigger student_progress_set_updated_at
before update on public.student_progress
for each row execute function public.set_updated_at();

drop trigger if exists number_cards_set_updated_at on public.number_cards;
create trigger number_cards_set_updated_at
before update on public.number_cards
for each row execute function public.set_updated_at();

drop trigger if exists skill_cards_set_updated_at on public.skill_cards;
create trigger skill_cards_set_updated_at
before update on public.skill_cards
for each row execute function public.set_updated_at();

drop trigger if exists arena_speed_profiles_set_updated_at on public.arena_speed_profiles;
create trigger arena_speed_profiles_set_updated_at
before update on public.arena_speed_profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.teachers enable row level security;
alter table public.student_progress enable row level security;
alter table public.chest_slots enable row level security;
alter table public.matches enable row level security;
alter table public.problem_attempts enable row level security;
alter table public.number_cards enable row level security;
alter table public.skill_cards enable row level security;
alter table public.chest_rewards enable row level security;
alter table public.arena_speed_profiles enable row level security;
alter table public.match_speed_stats enable row level security;

drop policy if exists "Teachers can read own membership" on public.teachers;
create policy "Teachers can read own membership"
on public.teachers
for select
to authenticated
using (auth_user_id = auth.uid() and is_active);

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

drop policy if exists "Teachers can read profiles" on public.profiles;
create policy "Teachers can read profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1 from public.teachers
    where teachers.auth_user_id = auth.uid()
      and teachers.is_active
  )
);

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

drop policy if exists "Teachers can read progress" on public.student_progress;
create policy "Teachers can read progress"
on public.student_progress
for select
to authenticated
using (
  exists (
    select 1 from public.teachers
    where teachers.auth_user_id = auth.uid()
      and teachers.is_active
  )
);

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

drop policy if exists "Teachers can read chest slots" on public.chest_slots;
create policy "Teachers can read chest slots"
on public.chest_slots
for select
to authenticated
using (
  exists (
    select 1 from public.teachers
    where teachers.auth_user_id = auth.uid()
      and teachers.is_active
  )
);

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

drop policy if exists "Teachers can read matches" on public.matches;
create policy "Teachers can read matches"
on public.matches
for select
to authenticated
using (
  exists (
    select 1 from public.teachers
    where teachers.auth_user_id = auth.uid()
      and teachers.is_active
  )
);

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

drop policy if exists "Teachers can read problem attempts" on public.problem_attempts;
create policy "Teachers can read problem attempts"
on public.problem_attempts
for select
to authenticated
using (
  exists (
    select 1 from public.teachers
    where teachers.auth_user_id = auth.uid()
      and teachers.is_active
  )
);

drop policy if exists "Students own number cards" on public.number_cards;
drop policy if exists "Students can use username number cards" on public.number_cards;
create policy "Students own number cards"
on public.number_cards
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = number_cards.profile_id
      and profiles.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = number_cards.profile_id
      and profiles.auth_user_id = auth.uid()
  )
);

create policy "Students can use username number cards"
on public.number_cards
for all
to anon
using (true)
with check (true);

drop policy if exists "Teachers can read number cards" on public.number_cards;
create policy "Teachers can read number cards"
on public.number_cards
for select
to authenticated
using (
  exists (
    select 1 from public.teachers
    where teachers.auth_user_id = auth.uid()
      and teachers.is_active
  )
);

drop policy if exists "Students own skill cards" on public.skill_cards;
drop policy if exists "Students can use username skill cards" on public.skill_cards;
create policy "Students own skill cards"
on public.skill_cards for all to authenticated
using (exists (select 1 from public.profiles where profiles.id = skill_cards.profile_id and profiles.auth_user_id = auth.uid()))
with check (exists (select 1 from public.profiles where profiles.id = skill_cards.profile_id and profiles.auth_user_id = auth.uid()));
create policy "Students can use username skill cards"
on public.skill_cards for all to anon using (true) with check (true);
drop policy if exists "Teachers can read skill cards" on public.skill_cards;
create policy "Teachers can read skill cards"
on public.skill_cards for select to authenticated
using (exists (select 1 from public.teachers where teachers.auth_user_id = auth.uid() and teachers.is_active));

drop policy if exists "Students own chest rewards" on public.chest_rewards;
drop policy if exists "Students can use username chest rewards" on public.chest_rewards;
create policy "Students own chest rewards"
on public.chest_rewards for all to authenticated
using (exists (
  select 1 from public.chest_slots join public.profiles on profiles.id = chest_slots.profile_id
  where chest_slots.id = chest_rewards.chest_id and profiles.auth_user_id = auth.uid()
))
with check (exists (
  select 1 from public.chest_slots join public.profiles on profiles.id = chest_slots.profile_id
  where chest_slots.id = chest_rewards.chest_id and profiles.auth_user_id = auth.uid()
));
create policy "Students can use username chest rewards"
on public.chest_rewards for all to anon using (true) with check (true);
drop policy if exists "Teachers can read chest rewards" on public.chest_rewards;
create policy "Teachers can read chest rewards"
on public.chest_rewards for select to authenticated
using (exists (select 1 from public.teachers where teachers.auth_user_id = auth.uid() and teachers.is_active));

drop policy if exists "Students own arena speed profiles" on public.arena_speed_profiles;
drop policy if exists "Students can use username arena speed profiles" on public.arena_speed_profiles;
create policy "Students own arena speed profiles"
on public.arena_speed_profiles for all to authenticated
using (exists (select 1 from public.profiles where profiles.id = arena_speed_profiles.profile_id and profiles.auth_user_id = auth.uid()))
with check (exists (select 1 from public.profiles where profiles.id = arena_speed_profiles.profile_id and profiles.auth_user_id = auth.uid()));
create policy "Students can use username arena speed profiles"
on public.arena_speed_profiles for all to anon using (true) with check (true);
drop policy if exists "Teachers can read arena speed profiles" on public.arena_speed_profiles;
create policy "Teachers can read arena speed profiles"
on public.arena_speed_profiles for select to authenticated
using (exists (select 1 from public.teachers where teachers.auth_user_id = auth.uid() and teachers.is_active));

drop policy if exists "Students own match speed stats" on public.match_speed_stats;
drop policy if exists "Students can use username match speed stats" on public.match_speed_stats;
create policy "Students own match speed stats"
on public.match_speed_stats for all to authenticated
using (exists (select 1 from public.profiles where profiles.id = match_speed_stats.profile_id and profiles.auth_user_id = auth.uid()))
with check (exists (select 1 from public.profiles where profiles.id = match_speed_stats.profile_id and profiles.auth_user_id = auth.uid()));
create policy "Students can use username match speed stats"
on public.match_speed_stats for all to anon using (true) with check (true);
drop policy if exists "Teachers can read match speed stats" on public.match_speed_stats;
create policy "Teachers can read match speed stats"
on public.match_speed_stats for select to authenticated
using (exists (select 1 from public.teachers where teachers.auth_user_id = auth.uid() and teachers.is_active));
