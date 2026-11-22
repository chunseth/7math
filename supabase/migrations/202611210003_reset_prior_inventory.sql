begin;
set local search_path=mentalist,public;
set local lock_timeout='10s';

-- The live reset can precede the application rollout. Replaying the migration
-- must preserve cards earned and upgrades bought after that first reset.
create table if not exists mentalist.inventory_resets (
  name text primary key,
  applied_at timestamptz not null default clock_timestamp()
);

do $reset$
begin
  insert into mentalist.inventory_resets(name) values ('prior_inventory_20261121')
  on conflict do nothing;
  if not found then return; end if;

  -- Student operations take the same profile lock before granting or spending rewards.
  perform id from public.profiles order by id for update;
  delete from mentalist.cards;
  delete from public.number_cards;
  delete from public.skill_cards;

  -- Preserve the purchase history and free the per-level purchase keys for re-earning.
  update mentalist.ledger set source='prior_inventory_20261121.' || source
  where source like 'upgrade.%';

  delete from mentalist.chests where legacy_slot is not null and opened is null;
  delete from public.chest_rewards r using public.chest_slots s
  where r.chest_id=s.id and r.claimed_at is null and s.state in ('waiting','unlocking','ready');
  update public.chest_slots set state='empty',rarity='common',reward_type=null,reward_number=null,
    reward_coins=null,reward_card_count=null,earned_at=null,unlock_started_at=null,ready_at=null,opened_at=null
  where state in ('waiting','unlocking','ready');
end;
$reset$;
commit;
