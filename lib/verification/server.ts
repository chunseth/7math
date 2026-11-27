import type { PoolClient } from "pg";
import { GameError, one, rows, type Identity } from "../mentalist/db";
import { gradeQuestion } from "../mentalist/model";
import { verificationCatalog } from "./catalog";
import { nextReview, type ReviewDecision } from "./model";

function currentSet(id: unknown) {
  const catalog = verificationCatalog();
  if (id !== catalog.set.id) throw new GameError("This review set has changed. Reload Verification.", 409);
  return catalog;
}

type ReviewInput = { setId?: unknown; example?: unknown; raw?: unknown };

function currentExample(input: ReviewInput) {
  const { set, sources } = currentSet(input.setId);
  const item = typeof input.example === "string" ? sources.get(input.example) : undefined;
  if (!item) throw new GameError("This verification question is unavailable.", 404);
  return { set, item };
}

export function checkReview(input: ReviewInput) {
  const { item: { question } } = currentExample(input);
  const result = typeof input.raw === "string" && gradeQuestion(question, question.answer, input.raw);
  if (!result) throw new GameError("Finish the answer before checking it.", 422);
  return { outcome: result.outcome };
}

const decisionColumns = 'case_id as id,status,note,saved_at as "savedAt"';

export async function reviewProgress(db: PoolClient, who: Identity, setId: string) {
  const decisions = await rows<ReviewDecision>(db,
    `select ${decisionColumns} from verification_set_decisions where profile=$1 and review_set_id=$2`,
    [who.profile, setId]);
  return Object.fromEntries(decisions.map(decision => [decision.id, decision]));
}

export async function saveReview(
  db: PoolClient,
  who: Identity,
  input: ReviewInput & { status?: unknown; note?: unknown },
): Promise<ReviewDecision> {
  const { set, item } = currentExample(input);
  const progress = await reviewProgress(db, who, set.id);
  if (progress[item.id]) return progress[item.id];
  if (nextReview(set, progress)?.id !== item.id) {
    throw new GameError("Continue from your current question.", 409);
  }

  let note: string | null = null;
  if (input.status === "accepted") {
    const marked = typeof input.raw === "string" && gradeQuestion(item.question, item.question.answer, input.raw);
    if (!marked || marked.outcome !== "correct") {
      throw new GameError("Answer the question correctly before accepting it.", 422);
    }
  } else if (input.status === "flagged") {
    note = typeof input.note === "string" ? input.note.trim() : "";
    if (!note || Array.from(note).length > 1500) throw new GameError("Describe the issue in 1–1,500 characters.", 422);
  } else if (input.status !== "skipped") {
    throw new GameError("Choose Accept problem, Report a bug, or Skip question.");
  }

  const [saved] = await rows<ReviewDecision>(db,
    `insert into verification_set_decisions
       (profile,review_set_id,case_id,grade,bank_version,level_id,question_id,status,note,snapshot)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (profile,review_set_id,case_id) do nothing returning ${decisionColumns}`,
    [who.profile, set.id, item.id, item.grade, item.bankVersion, item.level, item.questionId, input.status, note,
      JSON.stringify({ question: set.cases.find(candidate => candidate.id === item.id)!.question })]);
  return saved ?? one<ReviewDecision>(db,
    `select ${decisionColumns} from verification_set_decisions where profile=$1 and review_set_id=$2 and case_id=$3`,
    [who.profile, set.id, item.id]);
}

export function exportReviewBugs(db: PoolClient, who: Identity, setId: unknown) {
  const { set } = currentSet(setId);
  return rows(db,
    `select grade,bank_version as "bankVersion",level_id as "levelId",question_id as "questionId",
       saved_at as "reportedAt",note,snapshot from verification_set_decisions
       where profile=$1 and review_set_id=$2 and status='flagged' order by saved_at,grade,case_id`,
    [who.profile, set.id]);
}
