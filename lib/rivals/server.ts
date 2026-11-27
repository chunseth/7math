import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { publicQuestion, type BankQuestion } from "../mentalist/bank";
import { GameError, hash, one, rows, uuid, type Identity } from "../mentalist/db";
import { gradeQuestion, type Outcome } from "../mentalist/model";
import { drawRush } from "../rush/bank";
import { rushGrade, rushGrades, rushLength, type RushGrade } from "../rush/model";
import { countdownMs, queueLeaseMs, raceDecision, type QueueCounts, type ResultReason, type RivalProgress, type RivalsAnswer, type RivalsState } from "./model";

type Entry = { grade: RushGrade; ticket: string | null; match: string | null };
type Match = {
  id: string;
  grade: RushGrade;
  startsAt: Date;
  questions: BankQuestion[] | null;
  reason: ResultReason | null;
  winner: string | null;
};
type Player = RivalProgress & { profile: string; seenAt: Date; draft: string | null };
type Draft = { match: string; question: number; text: string };
type Race = { match: Match; you: Player; opponent: Player; now: number };
type Submission = { id: string; question: number; raw: string | null };
type Action = "rivalsJoin" | "rivalsState" | "rivalsCancel" | "rivalsAnswer" | "rivalsForfeit" | "rivalsQueue";

export function isRivalsAction(value: string): value is Action {
  return value === "rivalsJoin" || value === "rivalsState" || value === "rivalsCancel" ||
    value === "rivalsAnswer" || value === "rivalsForfeit" || value === "rivalsQueue";
}

async function queueLock(db: PoolClient) {
  // Queue operations acquire this before touching entries. Races lock only their match.
  await db.query("select pg_advisory_xact_lock(728201, 1)");
}

async function currentEntry(db: PoolClient, profile: string) {
  return (await rows<Entry>(db, "select grade,ticket,match from rivals_entries where profile=$1", [profile]))[0];
}

async function heartbeatQueue(db: PoolClient, profile: string, entry: Entry) {
  if (!entry.ticket) return false;
  const updated = await db.query(
    `update rivals_entries set last_seen=clock_timestamp()
     where profile=$1 and ticket=$2 and last_seen > clock_timestamp()-$3 * interval '1 millisecond'`,
    [profile, entry.ticket, queueLeaseMs],
  );
  return !!updated.rowCount;
}

async function dbTime(db: PoolClient) {
  return (await one<{ time: Date }>(db, "select clock_timestamp() as time")).time.getTime();
}

async function closeRace(db: PoolClient, race: Race, reason: ResultReason, winner: string | null) {
  await db.query("update rivals_matches set reason=$2,winner=$3,questions=null where id=$1",
    [race.match.id, reason, winner]);
  await db.query("update rivals_players set draft=null where match=$1 and draft is not null", [race.match.id]);
  Object.assign(race.match, { reason, winner, questions: null });
}

async function openRace(db: PoolClient, id: string, profile: string): Promise<Race> {
  const match = await one<Match>(db, `select id,grade,starts_at as "startsAt",questions,reason,winner
    from rivals_matches where id=$1 for update`, [id]);
  const players = await rows<Player>(db, `select r.profile,r.username,r.resolved,r.mistakes,r.draft,
    r.finished_ms as "finishedMs",r.last_seen as "seenAt",coalesce(p.sprite_name,'raijin') as sprite,
    array(select a.question from rivals_answers a where a.match=r.match and a.profile=r.profile
      and a.outcome='incorrect' order by a.question) as missed
    from rivals_players r left join public.profiles p on p.id=r.profile where r.match=$1`, [id]);
  const you = players.find(player => player.profile === profile);
  const opponent = players.find(player => player.profile !== profile);
  if (!you || !opponent) throw new GameError("This race is unavailable.", 404);
  const race = { match, you, opponent, now: await dbTime(db) };
  if (!match.reason) await settleRace(db, race);
  return race;
}

async function settleRace(db: PoolClient, race: Race) {
  const timed = (player: Player) => ({ ...player, lastSeen: player.seenAt.getTime() });
  const players = [race.you, race.opponent] as const;
  const decision = raceDecision([timed(race.you), timed(race.opponent)], race.match.startsAt.getTime(), race.now);
  if (decision) await closeRace(db, race, decision.reason,
    decision.winner === null ? null : players[decision.winner].profile);
}

async function touchRace(db: PoolClient, { match, you, opponent, now }: Race, draft?: Draft) {
  if (match.reason || you.finishedMs !== null) return;
  if (draft?.match === match.id && draft.question === you.resolved && opponent.finishedMs !== null &&
      now >= match.startsAt.getTime()) you.draft = draft.text;
  await db.query("update rivals_players set last_seen=$3,draft=$4 where match=$1 and profile=$2",
    [match.id, you.profile, new Date(now), you.draft]);
}

function raceView({ match, you, opponent, now }: Race): RivalsState {
  function progress({ username, sprite, missed, resolved, mistakes, finishedMs }: Player): RivalProgress {
    return { username, sprite, missed, resolved, mistakes, finishedMs };
  }
  const startsAt = match.startsAt.getTime();
  const game = { grade: match.grade, match: match.id, startsAt, serverNow: now,
    you: progress(you), opponent: progress(opponent) };
  if (match.reason) {
    const outcome = match.reason === "abandoned" ? "no contest" :
      match.winner === null ? "draw" : match.winner === you.profile ? "win" : "loss";
    return { ...game, phase: "result", result: { reason: match.reason, outcome } };
  }
  if (now < startsAt) return { ...game, phase: "countdown" };
  if (you.finishedMs !== null) {
    const question = match.questions?.[opponent.resolved];
    if (question) return { ...game, phase: "racing", spectating: { question: publicQuestion(question), draft: opponent.draft } };
  }
  const question = match.questions?.[you.resolved];
  return { ...game, phase: "racing", question: question ? publicQuestion(question) : undefined };
}

async function matchState(db: PoolClient, profile: string, id: string, draft?: Draft) {
  const race = await openRace(db, id, profile);
  await touchRace(db, race, draft);
  return raceView(race);
}

async function state(db: PoolClient, profile: string, draft?: Draft): Promise<RivalsState> {
  const entry = await currentEntry(db, profile);
  if (entry?.match) return matchState(db, profile, entry.match, draft);
  if (entry?.ticket) {
    if (await heartbeatQueue(db, profile, entry)) return { phase: "waiting", grade: entry.grade, ticket: entry.ticket };
    // Pairing may have claimed this entry while its heartbeat was waiting on the row.
    const matched = await currentEntry(db, profile);
    if (matched?.match) return matchState(db, profile, matched.match);
  }
  return { phase: "idle" };
}

async function join(db: PoolClient, profile: string, grade: RushGrade): Promise<RivalsState> {
  await queueLock(db);
  const existing = await state(db, profile);
  if (existing.phase === "waiting" || existing.phase === "countdown" || existing.phase === "racing") return existing;

  const ticket = randomUUID();
  await db.query(`insert into rivals_entries(profile,grade,ticket,queued_at,last_seen)
    values($1,$2,$3,clock_timestamp(),clock_timestamp())
    on conflict(profile) do update set grade=excluded.grade,ticket=excluded.ticket,
      queued_at=excluded.queued_at,last_seen=excluded.last_seen,match=null`, [profile, grade, ticket]);
  const [opponent] = await rows<{ profile: string }>(db, `select profile from rivals_entries
    where grade=$1 and profile<>$2 and ticket is not null and last_seen > clock_timestamp()-$3 * interval '1 millisecond'
    order by queued_at,profile limit 1 for update`, [grade, profile, queueLeaseMs]);
  if (!opponent) return { phase: "waiting", grade, ticket };

  const { pack, selected } = drawRush(grade);
  const now = await dbTime(db);
  await db.query("insert into rivals_matches(id,grade,starts_at,questions) values($1,$2,$3,$4)",
    [pack.set, grade, new Date(now + countdownMs), JSON.stringify(selected)]);
  const profiles = [profile, opponent.profile];
  await db.query(`insert into rivals_players(match,profile,username,last_seen)
    select $1,id,username,$3 from public.profiles where id=any($2::uuid[])`, [pack.set, profiles, new Date(now)]);
  await db.query("update rivals_entries set match=$1,ticket=null,queued_at=null where profile=any($2::uuid[])",
    [pack.set, profiles]);
  return matchState(db, profile, pack.set);
}

async function cancel(db: PoolClient, profile: string, ticket: string) {
  await queueLock(db);
  await db.query("update rivals_entries set ticket=null,queued_at=null where profile=$1 and ticket=$2", [profile, ticket]);
  return state(db, profile);
}

async function answer(db: PoolClient, race: Race, submission: Submission): Promise<RivalsAnswer> {
  const { match, you, now } = race;
  const digest = hash(JSON.stringify(submission.raw));
  const [prior] = await rows<{ question: number; digest: string; outcome: Outcome }>(db,
    `select question,payload_hash as digest,outcome from rivals_answers where match=$1 and profile=$2 and id=$3`,
    [match.id, you.profile, submission.id]);
  if (prior) {
    if (prior.question !== submission.question || prior.digest !== digest)
      throw new GameError("This submission identifier was already used.", 409);
    await touchRace(db, race);
    return { outcome: prior.outcome, state: raceView(race) };
  }

  if (match.reason || now < match.startsAt.getTime() || you.resolved !== submission.question) {
    await touchRace(db, race);
    return { state: raceView(race) };
  }
  const question = match.questions?.[you.resolved];
  if (!question) throw new GameError("This question is unavailable.", 409);
  const outcome = submission.raw === null ? "incorrect" : gradeQuestion(question, question.answer, submission.raw)?.outcome;
  if (!outcome) throw new GameError("Complete your answer before submitting.");

  await db.query("insert into rivals_answers(match,profile,id,question,payload_hash,outcome) values($1,$2,$3,$4,$5,$6)",
    [match.id, you.profile, submission.id, submission.question, digest, outcome]);
  if (outcome !== "simplification") {
    if (outcome === "incorrect") {
      you.mistakes++;
      you.missed.push(you.resolved);
    }
    you.resolved++;
    if (you.resolved === rushLength) you.finishedMs = now - match.startsAt.getTime();
  }
  you.seenAt = new Date(now);
  await db.query(`update rivals_players set resolved=$3,mistakes=$4,finished_ms=$5,last_seen=$6,draft=null
    where match=$1 and profile=$2`, [match.id, you.profile, you.resolved, you.mistakes, you.finishedMs, you.seenAt]);
  await settleRace(db, race);
  return { outcome, state: raceView(race) };
}

export async function rivals(db: PoolClient, who: Identity, action: Action, body: Record<string, unknown>) {
  const profile = who.profile;
  if (action === "rivalsQueue") {
    const counts = Object.fromEntries(rushGrades.map(grade => [grade, 0])) as QueueCounts;
    const waiting = await rows<{ grade: RushGrade; total: number }>(db, `select grade, count(*)::int as total
      from rivals_entries where ticket is not null and last_seen > clock_timestamp()-$1 * interval '1 millisecond'
      group by grade`, [queueLeaseMs]);
    for (const { grade, total } of waiting) counts[grade] = total;
    return counts;
  }
  if (action === "rivalsState") {
    const { match, question, draft } = body;
    const preview = typeof draft === "string" && /^[0-9□+−.*÷×/%()^π! -]{0,256}$/u.test(draft) && typeof question === "number" &&
      Number.isInteger(question) && typeof match === "string" ? { match, question, text: draft } : undefined;
    return state(db, profile, preview);
  }
  if (action === "rivalsJoin") {
    const grade = rushGrade(body.grade);
    if (!grade) throw new GameError("Choose Grade 6, 7, or 8.");
    return join(db, profile, grade);
  }
  if (action === "rivalsCancel") return cancel(db, profile, uuid(body.ticket));

  const id = uuid(body.match);
  const entry = await currentEntry(db, profile);
  if (entry?.match !== id) throw new GameError("This race is unavailable.", 404);
  const race = await openRace(db, id, profile);
  if (action === "rivalsForfeit") {
    if (!race.match.reason) await closeRace(db, race, "forfeit", race.opponent.profile);
    return raceView(race);
  }

  const { question, raw } = body;
  if (typeof question !== "number" || !Number.isInteger(question) || question < 0 || question >= rushLength ||
    (raw !== null && (typeof raw !== "string" || raw.length > 256))) {
    throw new GameError("Send an answer or skip for the current question.");
  }
  return answer(db, race, { id: uuid(body.id), question, raw });
}
