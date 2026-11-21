begin;
set local search_path=mentalist,public;
create table owned_sprites(profile uuid references public.profiles, sprite text, primary key(profile,sprite));
insert into owned_sprites(profile,sprite) select id,sprite_name from public.profiles;
alter table chests add column legacy_slot uuid unique references public.chest_slots(id);
-- Pending legacy rewards keep their payload and their original timer. They
-- occupy the same four slots as newly earned curriculum chests.
insert into chests(profile,slot,skill,reward,ready,legacy_slot)
select profile_id,slot_index,'legacy','coins',
  case when state='ready' then coalesce(ready_at,now()) else ready_at end,id
from public.chest_slots where state in ('waiting','unlocking','ready');
commit;
