import type { PoolClient } from "pg";
import { randomInt, randomUUID } from "node:crypto";
import { damageRangeForLevel } from "../gameplay";
import { gradeOf, cardTopic, checkpoint, evaluate, gradeQuestion, playable, type Question, type Recorded, type RunView } from "./model";
import { course, publishedFor, publishedVersions, recommend } from "./student";
import { advance, checkText, type Attempt, type LevelPack, type RoundRules } from "./round";
import { GameError, hash, one, rows, uuid, type Identity } from "./db";
import { swordDamage } from "./craft";
import { publicQuestion } from "./bank";

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
      [profile, cardTopic(skill!), cards],
    );
}
async function openEncounter(db: PoolClient, run: string, position: number) {
  await db.query(
    `insert into encounters(run,position,question,version,snapshot)
    select r.id,$2,q.id,r.version,q.definition || jsonb_build_object('variant',p.item->>'variant','parameters',p.item->'parameters')
    from runs r join sets s on s.version=r.version and s.id=r.set_id
    cross join lateral (select coalesce(r.policy->'positions',s.positions)->($2::int-1) as item) p
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
    "select e.id,e.position,(select count(*)::int from events where encounter=e.id) revision,snapshot as question from encounters e where run=$1 and resolved is null",
    [id],
  );
  const [next] =
    r.status === "completed" && gradeOf(r.level) === 7
      ? await rows(db, "select level,reason from recommendations where profile=$1 and level is not null", [
          profile,
        ])
      : [];
  const rank = r.result?.stars === 3
    ? await one(db, "select total_rank from level_leaderboard where level=$1 and profile=$2", [r.level, profile])
    : undefined;
  return { ...r, next, leaderboardRank: rank?.total_rank,
    encounter: r.status === "active" && e ? { ...e, question: publicQuestion(e.question) } : undefined } as RunView;
}
async function selectSet(db: PoolClient, profile: string, level: string, preferred?: string) {
  return one(db, `select s.id,s.version,l.skill,s.positions,coalesce(l.definition->'pool',s.positions) as pool
    from (${publishedFor(gradeOf(level))}) pub join sets s using(level,version)
    join levels l on (s.version,s.level)=(l.version,l.id)
    left join lateral (select max(started) last from runs r where r.profile=$2 and r.version=s.version and r.set_id=s.id) played on true
    where s.level=$1 order by played.last asc nulls first,(s.id=$3) desc,random() limit 1`,
    [level, profile, preferred ?? null]);
}

async function checkAccess(db: PoolClient, who: Identity, level: string) {
  const entry = (await course(db, who, gradeOf(level))).access.find(a => a.id === level);
  if (!entry || !playable(entry)) throw new GameError(entry?.reason ?? "Unknown level.", 403);
}

export async function prepareLevel(db: PoolClient, who: Identity, level: string): Promise<LevelPack> {
  await checkAccess(db, who, level);
  const set = await selectSet(db, who.profile, level);
  const questions = await rows<{ definition: Question & { answer: string } }>(db,
    `select q.definition from jsonb_array_elements($2::jsonb) with ordinality p(slot,n)
     join questions q on q.version=$1 and q.id=p.slot->>'q'
     order by p.n`, [set.version, JSON.stringify(set.pool)]);
  return { level, set: set.id, questions: questions.map(({definition: q}, i) => ({
    ...publicQuestion(q),
    check: hash(checkText(set.id, i, q, q.answer)),
  })) };
}

type PoolSlot = { variant: string; target: number };

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function drawQuestions(pool: PoolSlot[], blueprint: PoolSlot[]) {
  const groups = new Map<string, number[]>();
  const category = (slot: PoolSlot) => JSON.stringify([slot.variant, slot.target]);
  for (const i of shuffle(pool.map((_, index) => index))) {
    const key = category(pool[i]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  }
  return shuffle(blueprint.map(slot => {
    const index = groups.get(category(slot))?.pop();
    if (index === undefined) throw new Error("Published question pool is missing a required variant.");
    return index;
  }));
}

export async function start(db: PoolClient, who: Identity, level: string, previous: string | null, prepared?: string) {
  await checkAccess(db, who, level);
  const [active] = await rows(db, "select id,level from runs where profile=$1 and status='active'", [who.profile]);
  if (active && gradeOf(active.level) !== gradeOf(level))
    throw new GameError(`Finish or leave your active ${gradeOf(active.level)}math battle first.`, 409);
  if (active && active.id !== previous) throw new GameError("Another battle started. Reload the map.", 409);
  const set = await selectSet(db, who.profile, level, prepared);
  if (prepared && set.id !== prepared) throw new GameError("This practice set has changed. Select Play again.", 409);
  if (active) await db.query("update runs set status='interrupted',ended=now() where id=$1", [active.id]);
  const order = drawQuestions(set.pool, set.positions);
  const positions = order.map(i => set.pool[i]);
  const [card] = await rows(db, "select upgrade from cards where profile=$1 and skill=$2", [
    who.profile,
    cardTopic(set.skill),
  ]);
  const [roster] = await rows(db, "select multiplier from roster where profile=$1 and class=$2", [
    who.profile,
    who.classId,
  ]);
  const upgrade = card?.upgrade ?? 1,
    multiplier = Number(roster?.multiplier ?? 1);
  const bonus = await swordDamage(db, who.profile);
  const [min, max] = damageRangeForLevel(upgrade);
  const policy = {
    version: 1,
    positions,
    upgrade,
    damage: [min + bonus, max + bonus],
    multiplier,
    targetMs:
      positions.reduce((sum: number, p: { target: number }) => sum + p.target * 1000, 0) * multiplier,
    pass: 10,
    enemyHealth: 40,
    missDamage: 25,
  };
  const [minHit, maxHit] = policy.damage;
  const rules: RoundRules | undefined = prepared ? {
    order, hits: order.map(() => randomInt(minHit, maxHit + 1)), missDamage: policy.missDamage, enemyHealth: policy.enemyHealth,
  } : undefined;
  const run = await one(
    db,
    `insert into runs(profile,session_token,class,version,level,skill,set_id,policy) values($1,$2,$3,$8,$4,$5,$6,$7) returning id`,
    [who.profile, who.token, who.classId, level, set.skill, set.id, { ...policy, rules }, set.version],
  );
  const offer = await db.query(
    "update offers set run=$1 where profile=$2 and target=$3 and run is null and not expired returning checkpoint",
    [run.id, who.profile, level],
  );
  if (offer.rowCount) await db.query("update runs set bonus=true where id=$1", [run.id]);
  await openEncounter(db, run.id, 1);
  return { ...await runView(db, who.profile, run.id), rules };
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
    r.policy.positions?.map((slot: { evidence?: string }) => slot.evidence),
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
        `insert into offers(profile,checkpoint,target,expires_level) select $1,$2,$3,$4 where exists(select from (${publishedVersions}) pub where level=$3) on conflict do nothing`,
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
  if (r.policy.rules) throw new GameError("Save the answers for this level together.", 409);
  const e = await one(db, "select * from encounters where id=$1 and run=$2 and resolved is null", [
    uuid(input.encounter),
    r.id,
  ]);
  const marked =
    typeof input.raw === "string" && gradeQuestion(e.snapshot, e.snapshot.answer, input.raw);
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

// Re-grade the transcript against the run's saved set. Nothing is committed until
// every attempt is valid and the outer request transaction records its receipt.
export async function saveBattle(db: PoolClient, who: Identity, id: string, attempts: Attempt[], leave: boolean) {
  const r = await one(db, "select * from runs where id=$1 and profile=$2", [uuid(id), who.profile]);
  const rules: RoundRules = r.policy.rules;
  if (r.status !== "active" || !rules) throw new GameError("This battle has already ended.", 409);
  if (!Array.isArray(attempts)) throw new GameError("Missing battle answers.");
  const slots = await rows(db, `select q.id, q.definition || jsonb_build_object(
      'variant',p.slot->>'variant','parameters',p.slot->'parameters') as snapshot,
      coalesce(e.id,gen_random_uuid()) as encounter
    from runs r cross join lateral jsonb_array_elements(r.policy->'positions') with ordinality p(slot,n)
    join questions q on q.version=r.version and q.id=p.slot->>'q'
    left join encounters e on e.run=r.id and e.position=p.n where r.id=$1 order by p.n`, [id]);
  const startTime = new Date(r.started).getTime();
  const wall = Math.max(0, Date.now() - startTime);
  let state = { hp: r.hp as number, enemy_hp: r.enemy_hp as number, defeats: 0, resolved: 0 };
  let lastAt = 0, ordinal = 0, scored = 0;
  const encounters = [];
  const events = [];
  for (const a of attempts) {
    if (!a || typeof a.raw !== "string" || !Number.isSafeInteger(a.at) || a.at < lastAt ||
        !Number.isSafeInteger(a.elapsed) || a.elapsed < 1 || !state.hp || state.resolved === slots.length)
      throw new GameError("Invalid battle transcript.", 422);
    const slot = slots[state.resolved];
    const marked = gradeQuestion(slot.snapshot, slot.snapshot.answer, a.raw);
    if (!marked) throw new GameError("Incomplete answer in saved battle.", 422);
    const at = new Date(startTime + Math.min(a.at, wall));
    const active = a.at <= wall + 250 && a.elapsed <= a.at - lastAt + 250 && a.elapsed <= 86400000 ? a.elapsed : null;
    if (!ordinal) encounters.push({ id: slot.encounter, position: state.resolved + 1, question: slot.id,
      snapshot: slot.snapshot, opened: new Date(startTime + Math.min(lastAt, wall)), resolved: null as Date | null });
    events.push({ id: randomUUID(), encounter: slot.encounter, ordinal: ++ordinal,
      scored_number: marked.outcome === "simplification" ? null : ++scored,
      raw: a.raw, ...marked, active_ms: active, created: at });
    lastAt = a.at;
    state = advance(state, rules, marked.outcome);
    if (marked.outcome === "correct") {
      encounters[encounters.length - 1].resolved = at;
      ordinal = 0;
      scored = 0;
    }
  }
  const completed = state.resolved === 12;
  if (!leave && state.hp > 0 && !completed) throw new GameError("The level is still in progress.", 422);
  if (leave && !completed && state.hp > 0 && ordinal === 0 && state.resolved > 0) {
    const slot = slots[state.resolved];
    encounters.push({ id: slot.encounter, position: state.resolved + 1, question: slot.id,
      snapshot: slot.snapshot, opened: new Date(startTime + Math.min(lastAt, wall)), resolved: null });
  }
  await db.query(`insert into encounters(id,run,position,question,version,snapshot,opened,resolved)
    select x.id,$1,x.position,x.question,$2,x.snapshot,x.opened,x.resolved from jsonb_to_recordset($3::jsonb)
    x(id uuid,position int,question text,snapshot jsonb,opened timestamptz,resolved timestamptz)
    on conflict(run,position) do update set resolved=excluded.resolved`, [id,r.version,JSON.stringify(encounters)]);
  await db.query(`insert into events(id,encounter,ordinal,scored_number,raw,normalized,outcome,active_ms,created)
    select * from jsonb_to_recordset($1::jsonb) x(id uuid,encounter uuid,ordinal int,scored_number int,
    raw text,normalized text,outcome text,active_ms int,created timestamptz)`, [JSON.stringify(events)]);
  if (state.resolved) await db.query(`with earned as (
      insert into ledger(profile,source,skill,coins,xp,cards)
      select $1,'encounter.'||id,$2,10,10,1 from encounters where run=$3 and resolved is not null returning coins,xp,cards
    ), totals as (select sum(coins) as coins,sum(xp) as xp,sum(cards) as cards from earned),
    balance as (update public.profiles p set coins=p.coins+t.coins,xp=p.xp+t.xp from totals t where p.id=$1)
    insert into cards(profile,skill,amount) select $1,$4,cards from totals
    on conflict(profile,skill) do update set amount=cards.amount+excluded.amount`, [who.profile,r.skill,id,cardTopic(r.skill)]);
  await db.query(`update runs set hp=$2,enemy_hp=$3,defeats=$4,status=$5,ended=clock_timestamp() where id=$1`,
    [id,state.hp,state.enemy_hp,state.defeats,completed ? "completed" : state.hp ? "interrupted" : "knockdown"]);
  if (completed) await finish(db, who, r);
  return runView(db, who.profile, id);
}
