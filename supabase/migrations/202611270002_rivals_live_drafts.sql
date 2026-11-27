begin;
alter table mentalist.rivals_players
  add column draft text check (char_length(draft) <= 256);
commit;
