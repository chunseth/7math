-- Apply with the server-backed routes enabled at cutover. Plaintext PINs and
-- the old browser permissions must be removed in the same transaction.
begin;
set local search_path=mentalist,public,extensions;
insert into credentials(profile,pin_hash)
select id,crypt(pin_code,gen_salt('bf',10)) from public.profiles where pin_code is not null
on conflict(profile) do nothing;
update public.profiles set pin_code=null where pin_code is not null;
alter table public.profiles add constraint curriculum_pins_server_only check(pin_code is null);
revoke all on public.profiles,public.matches,public.problem_attempts,public.student_progress,
 public.number_cards,public.skill_cards,public.chest_slots,public.chest_rewards,public.crafters_progress,
 public.crafters_inventory,public.arena_speed_profiles,public.match_speed_stats,public.concept_assignments from public,anon,authenticated;
revoke all on function public.get_concept_assignments(text,text) from public,anon,authenticated;
alter table mentalist.sessions add column selected_class uuid references mentalist.classes;
commit;
