begin;
create table mentalist.crafted_tools (
  profile uuid references public.profiles(id) on delete cascade,
  tool_id text not null,
  slot text not null check (slot in ('pickaxe', 'sword')),
  equipped boolean not null default false,
  primary key (profile, tool_id)
);
create unique index one_equipped_tool_per_slot on mentalist.crafted_tools(profile, slot) where equipped;
revoke all on mentalist.crafted_tools from public, anon, authenticated;
commit;
