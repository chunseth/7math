begin;
set local search_path=mentalist,public;

-- Sum all edits and retries for each question before taking the minimum.
with problem_times as (
  select e.run, e.position,
    case when count(a.active_ms) = count(*) then sum(a.active_ms) end as ms
  from encounters e join events a on a.encounter=e.id
  join runs r on r.id=e.run and r.status='completed'
  group by e.run,e.position
), timings as (
  select run, case when count(ms)=12 then min(ms) end as fastest
  from problem_times group by run
)
update runs r set result=r.result || jsonb_build_object(
  'fastestProblemMs',t.fastest,
  'stars',least((r.result->>'stars')::int, greatest(1, 3-(r.result->>'retries')::int))
) from timings t where t.run=r.id;

with best as (
  select distinct on (profile,level) profile,level,id,(result->>'stars')::int as stars
  from runs where status='completed' and (result->>'passed')::boolean
  order by profile,level,(result->>'stars')::int desc,ended,id
)
update clears c set stars=b.stars,best_run=b.id from best b
where (c.profile,c.level)=(b.profile,b.level)
  and (c.stars,c.best_run) is distinct from (b.stars,b.id);

create index level_leaderboard_runs on runs(level,profile)
  where status='completed' and result->>'stars'='3';

create view level_leaderboard as
  select records.*,
    (rank() over (partition by level order by total_ms))::int as total_rank,
    (rank() over (partition by level order by fastest_ms))::int as problem_rank
  from (
    select level,profile,min((result->>'activeMs')::double precision) as total_ms,
      min((result->>'fastestProblemMs')::double precision) as fastest_ms
    from runs where status='completed' and result->>'stars'='3'
      and result->>'retries'='0' and result->>'fastestProblemMs' is not null
    group by level,profile
  ) records;

-- A retried final answer returns its saved response, including across a rollout.
update receipts a set response=jsonb_set(a.response,'{run}',
  (a.response->'run') || jsonb_build_object('result',r.result) ||
  case when r.result->>'stars'='3' then jsonb_build_object('leaderboardRank',l.total_rank) else '{}'::jsonb end)
from runs r left join level_leaderboard l on (l.level,l.profile)=(r.level,r.profile)
where a.action='answer' and a.response#>>'{run,status}'='completed'
  and a.response#>>'{run,id}'=r.id::text;
commit;
