import { createClient } from "@supabase/supabase-js";
import type { PoolClient } from "pg";
import { GameError, one, rows, uuid } from "./db";
import { curriculumVersion, skillById, levelById } from "./model";

export async function teacherUser(token: string) {
  if (!token) throw new GameError("Sign in with your teacher account.", 401);
  const auth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) throw new GameError("Teacher sign-in expired.", 401);
  return data.user.id;
}
export async function faculty(db: PoolClient, user: string, body: Record<string, any>) {
  const { id: teacher } = await one(
    db,
    "select id from public.teachers where auth_user_id=$1 and is_active",
    [user],
  );
  if (body.action === "createClass") {
    const name = String(body.name ?? "").trim(),
      tz = String(body.timezone || "America/Chicago");
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
    } catch {
      throw new GameError("Choose a valid class timezone.");
    }
    if (!name || name.length > 80) throw new GameError("Enter a class name under 81 characters.");
    await db.query("insert into classes(teacher,name,timezone) values($1,$2,$3)", [teacher, name, tz]);
  }
  if (body.action === "classes" || body.action === "createClass")
    return rows(db, "select id,name,timezone from classes where teacher=$1 order by name,id", [teacher]);
  const c = await one(db, "select id from classes where id=$1 and teacher=$2", [uuid(body.classId), teacher]);
  if (body.action === "enroll") {
    const p = await one(db, "select id from public.profiles where username=$1", [
      String(body.username).trim().toLowerCase(),
    ]);
    const enrolled = await db.query(
      "insert into roster(class,profile) values($1,$2) on conflict do nothing returning profile",
      [c.id, p.id],
    );
    if (enrolled.rowCount)
      await db.query(
        `insert into decisions(class,profile,skill,teacher,kind)
      select $1,$2,s.id,$3,'assignment' from public.concept_assignments a join skills s on s.version=$4 and s.definition->>'group'=a.concept_id
      where a.profile_id=$2 and a.teacher_id=$3 on conflict do nothing`,
        [c.id, p.id, teacher, curriculumVersion],
      );
  }
  if (body.action === "roster" || body.action === "enroll")
    return rows(
      db,
      `select p.id,p.username,m.multiplier,
      (select skill from runs where profile=p.id and class=m.class order by started desc limit 1) as skill,
      count(r.id) filter(where r.status='completed')::int as completed,
      count(r.id) filter(where r.status='knockdown')::int as knockdowns,
      count(distinct r.level) filter(where (r.result->>'passed')::boolean)::int as cleared,
      round((select avg((recent.result->>'firstTry')::numeric)*100/12 from (select result from runs where profile=p.id and class=m.class and status='completed' order by ended desc limit 5) recent)) as accuracy
    from roster m join public.profiles p on p.id=m.profile left join runs r on r.profile=p.id and r.class=m.class where m.class=$1 group by p.id,m.class,m.multiplier order by username`,
      [c.id],
    );
  if (body.action === "coverage") {
    const published = await rows(
      db,
      "select l.skill,count(distinct l.id)::int levels,count(s.id)::int sets from levels l join published_levels pub on (pub.level,pub.version)=(l.id,l.version) join sets s on (s.level,s.version)=(l.id,l.version) where l.version=$1 group by l.skill", [curriculumVersion],
    );
    return {
      published,
      requirements: await rows(
        db,
        'select group_id as "group",requirement,levels from evidence where version=$1 order by group_id,requirement', [curriculumVersion],
      ),
      outstanding: "Unrestricted written explanations require a separate teacher-reviewed activity.",
    };
  }
  const p = await one(db, "select profile from roster where class=$1 and profile=$2", [
    c.id,
    uuid(body.profile),
  ]);
  if (body.action === "timing") {
    const value = Number(body.multiplier);
    if (!Number.isFinite(value) || value < 0.5 || value > 4)
      throw new GameError("Timing must be between 0.5 and 4.");
    await db.query("update roster set multiplier=$3 where class=$1 and profile=$2", [c.id, p.profile, value]);
  }
  if (body.action === "assignment" || body.action === "placement") {
    if (!skillById.has(body.skill)) throw new GameError("Choose a playable skill.");
    await db.query(
      `insert into decisions(class,profile,skill,teacher,kind,due) values($1,$2,$3,$4,$5,$6)
      on conflict(class,profile,skill,kind) where removed is null do update set due=excluded.due`,
      [c.id, p.profile, body.skill, teacher, body.action, body.due || null],
    );
  }
  if (body.action === "remove")
    await db.query(
      "update decisions set removed=now() where id=$1 and profile=$2 and class=$3 and teacher=$4",
      [uuid(body.decision), p.profile, c.id, teacher],
    );
  if (body.action === "run") {
    const r = await one(
      db,
      "select id,version,set_id,level,status,started,ended,policy,result from runs where profile=$1 and class=$2 and id=$3",
      [p.profile, c.id, uuid(body.run)],
    );
    const positions = await rows(
      db,
      `select pos.n::int as position,q.definition->>'prompt' prompt,q.definition->'visual' visual,q.definition->>'answer' answer,pos.slot->>'variant' variant,
      e.resolved,e.opened,coalesce(ev.events,'[]') events from runs r join sets s on (r.version,r.set_id)=(s.version,s.id)
      cross join lateral jsonb_array_elements(coalesce(r.policy->'positions',s.positions)) with ordinality pos(slot,n)
      join questions q on q.version=s.version and q.id=pos.slot->>'q' left join encounters e on e.run=$1 and e.position=pos.n
      left join lateral(select jsonb_agg(jsonb_build_object('raw',raw,'normalized',normalized,'outcome',outcome,'ms',active_ms,'at',created,'attempt',scored_number) order by ordinal) events from events where encounter=e.id) ev on true
      where r.id=$1 order by pos.n`,
      [r.id],
    );
    return { run: r, positions };
  }
  if (!["student", "timing", "assignment", "placement", "remove"].includes(body.action))
    throw new GameError("Unknown teacher action.");
  const runs = await rows(
    db,
    "select id,level,status,started,ended,result from runs where profile=$1 and class=$2 order by started desc",
    [p.profile, c.id],
  );
  const decisions = await rows(
    db,
    "select id,kind,skill,due from decisions where profile=$1 and class=$2 and removed is null order by created",
    [p.profile, c.id],
  );
  const clears = await rows(
    db,
    "select level,max((result->>'stars')::int) as stars from runs where profile=$1 and class=$2 and (result->>'passed')::boolean group by level",
    [p.profile, c.id],
  );
  return { runs, decisions, clears: clears.map((x) => ({ ...x, title: levelById.get(x.level)?.title })) };
}
