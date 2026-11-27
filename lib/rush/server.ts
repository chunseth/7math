import type { PoolClient } from "pg";
import { GameError, one, rows, uuid, type Identity } from "../mentalist/db";
import { gradeQuestion } from "../mentalist/model";
import type { BankQuestion } from "../mentalist/bank";
import { drawRush } from "./bank";
import { rushGrades, rushLength, type RushBoard, type RushGrade, type RushRecord, type RushResult, type RushRun, type RushSaved } from "./model";

export async function startRush(db: PoolClient, who: Identity, grade: RushGrade): Promise<RushRun> {
  const { pack, selected } = drawRush(grade);
  await db.query("delete from rush_runs where profile=$1 and score is null and started<now()-interval '1 day'", [
    who.profile,
  ]);
  await db.query("insert into rush_runs(id,profile,questions,grade) values($1,$2,$3,$4)", [
    pack.set, who.profile, JSON.stringify(selected), grade,
  ]);
  return { grade, pack, ranked: true };
}

export async function finishRush(db: PoolClient, who: Identity, id: unknown, answers: unknown): Promise<RushSaved> {
  if (!Array.isArray(answers) || answers.length !== rushLength ||
      !answers.every(value => value === null || (typeof value === "string" && value.length <= 256))) {
    throw new GameError(`Send one answer or skip for each of the ${rushLength} questions.`);
  }
  const run = uuid(id);
  const saved = await one<{ grade: RushGrade | null; questions: BankQuestion[] | null; score: number | null; elapsedMs: number | null }>(db,
    `select grade,questions,score,elapsed_ms as "elapsedMs" from rush_runs where id=$1 and profile=$2 for update`,
    [run, who.profile],
  );
  let result: RushResult;
  if (saved.score !== null && saved.elapsedMs !== null) {
    result = { score: saved.score, elapsedMs: saved.elapsedMs };
  } else {
    if (!saved.questions) throw new GameError("This run is unavailable.", 409);
    let score = 0;
    for (const [index, question] of saved.questions.entries()) {
      if (answers[index] === null) continue;
      const marked = gradeQuestion(question, question.answer, answers[index]);
      if (!marked) throw new GameError("A Rush answer is incomplete.");
      if (marked.outcome === "correct") score++;
    }
    result = await one<RushResult>(db,
      `update rush_runs set score=$2, elapsed_ms=greatest(0,round(extract(epoch from (clock_timestamp()-started))*1000)),
        questions=null where id=$1 returning score,elapsed_ms as "elapsedMs"`,
      [run, score],
    );
  }
  return saved.grade === null ? result : { ...result, board: await rushBoard(db, who, saved.grade) };
}

export async function rushBoard(db: PoolClient, who: Identity, grade: RushGrade): Promise<RushBoard> {
  const [board] = await rushBoards(db, who, [grade]);
  return board;
}

export async function rushBoards(db: PoolClient, who: Identity, grades: readonly RushGrade[] = rushGrades): Promise<RushBoard[]> {
  const { username } = await one<{ username: string }>(db, "select username from public.profiles where id=$1", [who.profile]);
  const records = await rows<RushRecord & { grade: RushGrade }>(db,
    `with best as (
      select distinct on (grade,profile) grade,profile,score,elapsed_ms from rush_runs
      where grade=any($1::smallint[]) and score is not null order by grade,profile,score desc,elapsed_ms
    ), ranked as (
      select best.*, p.username,
        (rank() over (partition by grade order by score desc,elapsed_ms))::int as rank,
        row_number() over (partition by grade order by score desc,elapsed_ms,p.username) as position
      from best join public.profiles p on p.id=best.profile
    )
    select grade,rank,username,score,elapsed_ms as "elapsedMs"
    from ranked where position<=50 or profile=$2
    order by grade,position`, [grades, who.profile],
  );
  return grades.map(grade => ({
    grade,
    username,
    records: records.filter(row => row.grade === grade).map(({ rank, username, score, elapsedMs }) => ({
      rank, username, score, elapsedMs,
    })),
  }));
}
