begin;
set local search_path=mentalist,public;

-- Merge unspent cards once, retaining the highest purchased upgrade in each topic.
with moved as (
  delete from cards c using skills s
  where s.version=1 and s.id=c.skill
  returning c.profile,c.amount,c.upgrade,
    case s.definition->>'group'
      when 'review.multiply' then 'multiplication'
      when 'review.divide' then 'division'
      else s.definition->>'world'
    end as topic
)
insert into cards(profile,skill,amount,upgrade)
select profile,topic,sum(amount),max(upgrade) from moved group by profile,topic
on conflict(profile,skill) do update set
  amount=cards.amount+excluded.amount, upgrade=greatest(cards.upgrade,excluded.upgrade);

update offers set target='review.multiply.8-9.1'
where target='review.multiply.9.1' and run is null and not expired;
commit;
