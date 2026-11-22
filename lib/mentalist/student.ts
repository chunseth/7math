import type { PoolClient } from "pg";
import {
  accessMap,
  checkpoint,
  curriculumVersion,
  currentLevel,
  currentSkill,
  levelById,
  mainPathProgress,
  playable,
  skills,
  type StudentState,
  type Progress,
  type Access,
  type LevelRecord,
} from "./model";
import { GameError, rows, one, type Identity } from "./db";
import { equipment } from "./craft";

export function leaderboard(db: PoolClient, level: string) {
  if (!levelById.has(level)) throw new GameError("Unknown level.", 404);
  return rows<LevelRecord>(db, `select p.username,l.total_ms as "totalMs",l.fastest_ms as "fastestProblemMs",
    l.total_rank as "totalRank",l.problem_rank as "problemRank" from level_leaderboard l
    join public.profiles p on p.id=l.profile where l.level=$1 order by l.total_rank,p.username`, [level]);
}

// Grouped levels keep their IDs across the v2 and v3 content releases.
export const publishedVersions = `select level, max(version) as version from published_levels
  where version between 2 and ${curriculumVersion} group by level`;

export async function publishedLevelIds(db: PoolClient): Promise<string[]> {
  const records = await rows<{ level: string }>(db, publishedVersions);
  return records.map((record) => record.level);
}

export async function course(db: PoolClient, who: Identity) {
  const published = await publishedLevelIds(db);
  const saved = await rows<Progress>(db, "select level,stars,review_due from clears where profile=$1", [
    who.profile,
  ]);
  const byLevel = new Map<string, Progress>();
  for (const clear of saved) {
    const level = currentLevel(clear.level);
    const prior = byLevel.get(level);
    byLevel.set(level, {
      level,
      stars: Math.max(clear.stars, prior?.stars ?? 0),
      review_due: prior && prior.review_due > clear.review_due ? prior.review_due : clear.review_due,
    });
  }
  const clears = [...byLevel.values()];
  const history = await rows<{ level: string; skill: string; last: Date }>(
    db,
    "select level,skill,max(started) as last from runs where profile=$1 group by level,skill order by last desc",
    [who.profile],
  );
  const decisions = await rows(
    db,
    "select skill,kind from decisions where profile=$1 and class=$2 and removed is null",
    [who.profile, who.classId],
  );
  const assigned = new Set<string>(decisions.filter((d) => d.kind === "assignment").map((d) => currentSkill(d.skill)));
  const placed = new Set<string>(decisions.filter((d) => d.kind === "placement").map((d) => currentSkill(d.skill)));
  const access = accessMap(
    new Set(published),
    clears,
    new Set(history.map((r) => currentLevel(r.level))),
    assigned,
    placed,
  );
  return { access, assigned, placed, clears, history };
}
export async function recommend(db: PoolClient, who: Identity, data: Awaited<ReturnType<typeof course>>) {
  const { access, assigned, history, clears } = data;
  const latest = new Map(history.map((r) => [r.skill, 0]));
  for (const r of history) latest.set(r.skill, Math.max(latest.get(r.skill) ?? 0, +new Date(r.last)));
  const last = history[0]?.skill;
  const sorted = (items: Access[]) =>
    items.sort((a, b) => {
      const x = levelById.get(a.id)!.skill,
        y = levelById.get(b.id)!.skill;
      return Number(x === last) - Number(y === last) || (latest.get(x) ?? 0) - (latest.get(y) ?? 0);
    });
  const unfinished = access.filter((a) => playable(a) && a.state !== "cleared");
  const due = new Set(clears.filter((c) => +new Date(c.review_due) <= Date.now()).map((c) => c.level));
  const main = mainPathProgress(access);
  const mainEntry = main.next ? access.find((entry) => entry.id === main.next) : null;
  const categories: [Access[], string][] = [
    [unfinished.filter((a) => assigned.has(levelById.get(a.id)!.skill)), "Teacher assignment"],
    [mainEntry ? [mainEntry] : [], main.next === main.target ? "Next on main path" : "Required foundation"],
    [access.filter((a) => a.state === "cleared" && due.has(a.id)), "Due for review"],
  ];
  const category = categories.find(([items]) => items.length);
  const level = category
      ? (category[1] === "Teacher assignment" ? sorted(category[0])[0] : category[0][0]).id
      : null,
    reason = category?.[1] ?? null;
  await db.query(
    `insert into recommendations(profile,level,reason) values($1,$2,$3) on conflict(profile) do update set level=excluded.level,reason=excluded.reason,updated=now() where (recommendations.level,recommendations.reason) is distinct from (excluded.level,excluded.reason)`,
    [who.profile, level, reason],
  );
  return level && reason ? { level, reason } : null;
}
export async function quests(db: PoolClient, who: Identity) {
  const {
    day,
    done,
    resolved,
    skills: practiced,
  } = await one(
    db,
    `with zone as(select coalesce((select timezone from classes where id=$2),'America/Chicago') as tz),
  bounds as(select (now() at time zone tz)::date as day,tz from zone)
  select day::text,
    (select count(*)::int from runs where profile=$1 and status='completed' and (ended at time zone tz)::date=day) done,
    (select count(*)::int from encounters e join runs r on r.id=e.run where r.profile=$1 and (e.resolved at time zone tz)::date=day) resolved,
    (select count(distinct r.skill)::int from encounters e join runs r on r.id=e.run join events a on a.encounter=e.id where r.profile=$1 and (a.created at time zone tz)::date=day) skills from bounds`,
    [who.profile, who.classId],
  );
  const claims = new Set(
    (
      await rows(db, "select source from ledger where profile=$1 and source like $2", [
        who.profile,
        `quest.${day}.%`,
      ])
    ).map((r) => r.source),
  );
  return [
    { key: "finish", name: "Finish a 12-question run", count: done, goal: 1, coins: 25 },
    { key: "resolve", name: "Resolve 24 questions", count: resolved, goal: 24, coins: 50 },
    { key: "explore", name: "Practice two different skills", count: practiced, goal: 2, coins: 75 },
  ].map((q) => ({ ...q, id: `quest.${day}.${q.key}`, claimed: claims.has(`quest.${day}.${q.key}`) }));
}
export async function studentState(db: PoolClient, who: Identity): Promise<StudentState> {
  const data = await course(db, who);
  const profile = await one<StudentState["profile"]>(
    db,
    "select id,username,sprite_name,coins,xp from public.profiles where id=$1",
    [who.profile],
  );
  const cards = await rows<StudentState["cards"][number]>(
    db,
    "select skill,amount,upgrade from cards where profile=$1",
    [who.profile],
  );
  const legacy = await rows<StudentState["legacy"][number]>(
    db,
    "select number,level,card_count from public.number_cards where profile_id=$1 order by number",
    [who.profile],
  );
  const chests = await rows<StudentState["chests"][number]>(
    db,
    "select id,slot,ready from chests where profile=$1 and opened is null order by slot",
    [who.profile],
  );
  const offer = await rows(
    db,
    "select 1 from offers where profile=$1 and checkpoint=$2 and run is null and not expired",
    [who.profile, checkpoint.level],
  );
  const classes = await rows<StudentState["classes"][number]>(
    db,
    "select c.id,c.name from classes c join roster r on r.class=c.id where r.profile=$1 order by name",
    [who.profile],
  );
  const active = await rows(db, "select id,level from runs where profile=$1 and status='active'", [
    who.profile,
  ]);
  const appearance = await rows(db, "select title,frame from appearance where profile=$1", [who.profile]);
  const ownedSprites = (
    await rows(db, "select sprite from owned_sprites where profile=$1", [who.profile])
  ).map((r) => r.sprite);
  const legacySkills = await rows<StudentState["legacySkills"][number]>(
    db,
    "select skill_id,card_count,level from public.skill_cards where profile_id=$1 order by skill_id",
    [who.profile],
  );
  const cleared = new Set(data.clears.map((c) => c.level));
  return {
    profile,
    equipment: await equipment(db, who.profile),
    ownedSprites,
    legacySkills,
    access: data.access,
    recommendation: await recommend(db, who, data),
    cards,
    legacy,
    chests,
    quests: await quests(db, who),
    offer: !!offer.length,
    classes,
    classId: who.classId,
    activeRun: active[0]?.id ?? null,
    activeLevel: active[0]?.level ?? null,
    title: appearance[0]?.title ?? null,
    frame: appearance[0]?.frame ?? null,
    clearedSkills: skills.filter((s) => s.levels.every((_, i) => cleared.has(`${s.id}.${i + 1}`))).length,
  };
}
