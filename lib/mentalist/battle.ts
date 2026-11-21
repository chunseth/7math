import type { PoolClient } from "pg";
import { randomInt } from "node:crypto";
import { damageRangeForLevel } from "../gameplay";
import { checkpoint, evaluate, grade, playable, type Question, type Recorded, type RunView } from "./model";
import { course, recommend } from "./student";
import { GameError, one, rows, uuid, type Identity } from "./db";

export async function credit(
  db: PoolClient,
  profile: string,
  source: string,
  skill: string | null,
  coins: number,
  xp: number,
  cards: number,
) {
  await db.query("insert into ledger(profile,source,skill,coins,xp,cards) values($1,$2,$3,$4,$5,$6)", [
    profile,
    source,
    skill,
    coins,
    xp,
    cards,
  ]);
  await db.query("update public.profiles set coins=coins+$2,xp=xp+$3 where id=$1", [profile, coins, xp]);
  if (cards)
    await db.query(
      `insert into cards(profile,skill,amount) values($1,$2,$3) on conflict(profile,skill) do update set amount=cards.amount+excluded.amount`,
      [profile, skill, cards],
    );
}
async function openEncounter(db: PoolClient, run: string, position: number) {
  await db.query(
    `insert into encounters(run,position,question,version,snapshot)
    select r.id,$2,q.id,r.version,q.definition || jsonb_build_object('variant',p.item->>'variant','parameters',p.item->'parameters')
    from runs r join sets s on s.version=r.version and s.id=r.set_id
    cross join lateral (select s.positions->($2::int-1) as item) p
    join questions q on q.id=p.item->>'q' and q.version=r.version where r.id=$1`,
    [run, position],
  );
}
export async function runView(db: PoolClient, profile: string, id: string): Promise<RunView> {
  const r = await one(
    db,
    `select r.id,r.level,r.status,r.hp,r.enemy_hp,r.defeats,r.result,r.bonus,
    exists(select from offers where run=r.id and paid) as "bonusPaid",
    coalesce((r.policy->>'chest')::boolean,false) as chest,
    (select count(*)::int from encounters where run=r.id and resolved is not null) resolved
    from runs r where id=$1 and profile=$2`,
    [id, profile],
  );
  const [e] = await rows(
    db,
    "select e.id,e.position,(select count(*)::int from events where encounter=e.id) revision,snapshot-'answer'-'id'-'family'-'variant'-'parameters' as question from encounters e where run=$1 and resolved is null",
    [id],
  );
  const [next] =
    r.status === "completed"
      ? await rows(db, "select level,reason from recommendations where profile=$1 and level is not null", [
          profile,
        ])
      : [];
  const rank = r.result?.stars === 3
    ? await one(db, "select total_rank from level_leaderboard where level=$1 and profile=$2", [r.level, profile])
    : undefined;
  return { ...r, next, leaderboardRank: rank?.total_rank, encounter: r.status === "active" ? e : undefined } as RunView;
}
export async function start(db: PoolClient, who: Identity, level: string, previous: string | null) {
  const data = await course(db, who),
    entry = data.access.find((a) => a.id === level);
  if (!entry || !playable(entry)) throw new GameError(entry?.reason ?? "Unknown level.", 403);
  const [active] = await rows(db, "select id from runs where profile=$1 and status='active'", [who.profile]);
  if (active && active.id !== previous) throw new GameError("Another battle started. Reload the map.", 409);
  if (active) await db.query("update runs set status='interrupted',ended=now() where id=$1", [active.id]);
  const set = await one(
    db,
    `select s.id,l.skill,s.positions from sets s join levels l on (s.version,s.level)=(l.version,l.id)
    left join lateral (select max(started) last from runs r where r.profile=$2 and r.version=s.version and r.set_id=s.id) played on true
    where s.level=$1 and s.version=1 order by played.last asc nulls first,s.id limit 1`,
    [level, who.profile],
  );
  const [card] = await rows(db, "select upgrade from cards where profile=$1 and skill=$2", [
    who.profile,
    set.skill,
  ]);
  const [roster] = await rows(db, "select multiplier from roster where profile=$1 and class=$2", [
    who.profile,
    who.classId,
  ]);
  const upgrade = card?.upgrade ?? 1,
    multiplier = Number(roster?.multiplier ?? 1);
  const policy = {
    version: 1,
    upgrade,
    damage: damageRangeForLevel(upgrade),
    multiplier,
    targetMs:
      set.positions.reduce((sum: number, p: { target: number }) => sum + p.target * 1000, 0) * multiplier,
    pass: 10,
    enemyHealth: 40,
    missDamage: 25,
  };
  const run = await one(
    db,
    `insert into runs(profile,session_token,class,version,level,skill,set_id,policy) values($1,$2,$3,1,$4,$5,$6,$7) returning id`,
    [who.profile, who.token, who.classId, level, set.skill, set.id, policy],
  );
  const offer = await db.query(
    "update offers set run=$1 where profile=$2 and target=$3 and run is null and not expired returning checkpoint",
    [run.id, who.profile, level],
  );
  if (offer.rowCount) await db.query("update runs set bonus=true where id=$1", [run.id]);
  await openEncounter(db, run.id, 1);
  return runView(db, who.profile, run.id);
}
async function finish(db: PoolClient, who: Identity, r: Record<string, any>) {
  const positions = await rows<{ events: Recorded[] }>(
    db,
    `select jsonb_agg(jsonb_build_object('outcome',a.outcome,'active_ms',a.active_ms) order by a.ordinal) events from encounters e join events a on a.encounter=e.id where e.run=$1 group by e.position order by e.position`,
    [r.id],
  );
  const result = evaluate(
    positions.map((p) => p.events),
    r.policy.targetMs,
  );
  if (!result) throw new Error("Completed run has incomplete evidence.");
  await db.query("update runs set status='completed',ended=clock_timestamp(),result=$2 where id=$1", [
    r.id,
    result,
  ]);
  if (result.passed) {
    const clear = await one(
      db,
      `insert into clears(profile,level,first_run,best_run,stars,review_due) values($1,$2,$3,$3,$4,now()+interval '1 day')
      on conflict(profile,level) do update set best_run=case when excluded.stars>clears.stars then excluded.best_run else clears.best_run end,
      stars=greatest(clears.stars,excluded.stars),review_count=clears.review_count+1,
      review_due=now()+make_interval(days=>(array[1,3,7,14])[least(clears.review_count+2,4)]) returning first_run`,
      [who.profile, r.level, r.id, result.stars],
    );
    if (r.level === checkpoint.level && clear.first_run === r.id)
      await db.query(
        "insert into offers(profile,checkpoint,target,expires_level) select $1,$2,$3,$4 where exists(select from published_levels where version=1 and level=$3) on conflict do nothing",
        [who.profile, r.level, checkpoint.review, checkpoint.expiry],
      );
    await db.query("update offers set expired=true where profile=$1 and expires_level=$2 and run is null", [
      who.profile,
      r.level,
    ]);
    if (r.bonus && result.firstTry === 12) {
      await credit(db, who.profile, "bonus." + r.id, r.skill, checkpoint.coins, 0, 0);
      await db.query("update offers set paid=true where run=$1", [r.id]);
    }
    const chest = await db.query(
      `insert into chests(profile,slot,skill,reward) select $1,n,$2,$3 from generate_series(0,3) n where not exists(select from chests where profile=$1 and slot=n and opened is null) order by n limit 1 returning slot`,
      [who.profile, r.skill, randomInt(2) ? "coins" : "cards"],
    );
    if (chest.rowCount)
      await db.query(`update runs set policy=policy||'{"chest":true}'::jsonb where id=$1`, [r.id]);
  } else {
    await db.query("update clears set review_due=least(review_due,now()) where profile=$1 and level=$2", [
      who.profile,
      r.level,
    ]);
  }
  await recommend(db, who, await course(db, who));
}
export async function submit(
  db: PoolClient,
  who: Identity,
  input: {
    run: string;
    encounter: string;
    id: string;
    raw: string;
    elapsed: number | null;
    revision: number;
  },
) {
  const r = await one(db, "select * from runs where id=$1 and profile=$2", [uuid(input.run), who.profile]);
  if (r.status !== "active") throw new GameError("This battle has ended. Return to the trail.", 409);
  const e = await one(db, "select * from encounters where id=$1 and run=$2 and resolved is null", [
    uuid(input.encounter),
    r.id,
  ]);
  const marked =
    typeof input.raw === "string" && grade((e.snapshot as Question).control, e.snapshot.answer, input.raw);
  if (!marked) throw new GameError("Finish the answer before it can be checked.", 422);
  const prev = await one(
    db,
    "select count(*)::int as total,count(scored_number)::int as scored,max(created) as last from events where encounter=$1",
    [e.id],
  );
  if (input.revision !== prev.total)
    throw new GameError("This answer was edited in another tab. Return to the trail.", 409);
  const wall = Date.now() - new Date(prev.last ?? e.opened).getTime();
  const ms = input.elapsed;
  const active =
    typeof ms === "number" && Number.isSafeInteger(ms) && ms > 0 && ms <= wall + 250 && ms <= 86400000
      ? ms
      : null;
  await db.query(
    "insert into events(id,encounter,ordinal,scored_number,raw,normalized,outcome,active_ms) values($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      input.id,
      e.id,
      prev.total + 1,
      marked.outcome === "simplification" ? null : prev.scored + 1,
      input.raw,
      marked.normalized,
      marked.outcome,
      active,
    ],
  );
  if (marked.outcome === "incorrect") {
    const hp = Math.max(0, r.hp - r.policy.missDamage);
    await db.query(
      "update runs set hp=$2,status=case when $2=0 then 'knockdown' else status end,ended=case when $2=0 then clock_timestamp() else ended end where id=$1",
      [r.id, hp],
    );
  } else if (marked.outcome === "correct") {
    const [min, max] = r.policy.damage;
    const health = r.enemy_hp - randomInt(min, max + 1);
    await db.query("update runs set enemy_hp=$2,defeats=defeats+$3 where id=$1", [
      r.id,
      health > 0 ? health : r.policy.enemyHealth,
      Number(health <= 0),
    ]);
    await db.query("update encounters set resolved=clock_timestamp() where id=$1", [e.id]);
    await credit(db, who.profile, "encounter." + e.id, r.skill, 10, 10, 1);
    if (e.position === 12) await finish(db, who, r);
    else await openEncounter(db, r.id, e.position + 1);
  }
  return { outcome: marked.outcome, run: await runView(db, who.profile, r.id) };
}
