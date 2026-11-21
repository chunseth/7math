// Read-only reconciliation of committed evidence, results, and rewards.
const { Client } = require("pg");
async function audit() {
  if (!process.env.MENTALIST_DATABASE_URL) throw Error("Set MENTALIST_DATABASE_URL.");
  const db = new Client({ connectionString: process.env.MENTALIST_DATABASE_URL });
  await db.connect();
  try {
    await db.query("begin read only");
    await db.query("set local search_path=mentalist,public");
    const checks = {
      "Published levels without five sets": `select count(*) from published_levels p where 5<>(select count(*) from sets s where s.level=p.level and s.version=p.version)`,
      "Missing encounter rewards": `select count(*) from encounters e join runs r on r.id=e.run left join ledger l on l.profile=r.profile and l.source='encounter.'||e.id where e.resolved is not null and (l.id is null or (l.coins,l.cards,l.xp)<>(10,1,10))`,
      "Unpublished recommendations": `select count(*) from recommendations r where level is not null and not exists(select from published_levels p where p.level=r.level)`,
      "Inconsistent checkpoint payouts": `select count(*) from offers o where o.paid<>exists(select from ledger l where l.profile=o.profile and l.source='bonus.'||o.run and l.coins=25)`,
      "Academic replay differences": `with question as (
        select e.run,e.position,(array_agg(a.outcome order by a.ordinal) filter(where a.scored_number is not null))[1] first_scored,
          count(*) filter(where a.outcome='incorrect') retries,count(*) filter(where a.outcome='simplification') simplifications,
          bool_and(a.active_ms is not null) timed,sum(a.active_ms) ms
        from encounters e join events a on a.encounter=e.id group by e.run,e.position
      ), metrics as (select run,count(*) n,count(*) filter(where first_scored='correct') first_try,sum(retries) retries,
           sum(simplifications) simplifications,case when bool_and(timed) then sum(ms) end ms from question group by run)
      select count(*) from runs r left join metrics m on m.run=r.id where case when status='completed' then
        m.n is distinct from 12 or r.result is null or
        (r.result->>'firstTry')::int is distinct from m.first_try or
        (r.result->>'passed')::boolean is distinct from (m.first_try>=(r.policy->>'pass')::int) or
        (r.result->>'retries')::int is distinct from m.retries or (r.result->>'simplifications')::int is distinct from m.simplifications or
        (r.result->>'activeMs')::numeric is distinct from m.ms or
        (r.result->>'stars')::int is distinct from (case when m.first_try<(r.policy->>'pass')::int then 0
          when m.ms<=(r.policy->>'targetMs')::numeric then 3 when m.ms<=1.5*(r.policy->>'targetMs')::numeric then 2 else 1 end)
        else r.result is not null end`,
    };
    for (const [name, sql] of Object.entries(checks)) {
      const count = Number((await db.query(sql)).rows[0].count);
      console.log(name, count);
      if (count) process.exitCode = 1;
    }
    await db.query("commit");
  } finally {
    await db.end();
  }
}
audit().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
