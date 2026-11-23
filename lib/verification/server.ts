import type { PoolClient } from "pg";
import { GameError, one, rows, type Identity } from "../mentalist/db";
import { grade } from "../mentalist/model";
import { verificationCatalog } from "./catalog";
import { countReviews, reviewCases, verificationGrades, type ReviewDecision, type ReviewWorld } from "./model";

function currentExample(input: { grade?: unknown; version?: unknown; example?: unknown }) {
  if (input.grade !== 6 && input.grade !== 7 && input.grade !== 8) throw new GameError("Choose a verification world.");
  const { world, keys } = verificationCatalog(input.grade);
  if (input.version !== world.version) throw new GameError("This question bank has changed. Reload the trail.", 409);
  const example = typeof input.example === "string" ? keys.get(input.example) : undefined;
  if (!example) throw new GameError("This verification example is unavailable.", 404);
  return { world, example };
}

export function checkReview(input: { grade?: unknown; version?: unknown; example?: unknown; raw?: unknown }) {
  const { example } = currentExample(input);
  const result = typeof input.raw === "string" && grade(example.control, example.answer, input.raw);
  if (!result) throw new GameError("Finish the answer before checking it.", 422);
  return { outcome: result.outcome };
}

const decisionColumns = 'case_id as id,status,note,saved_at as "savedAt"';

export async function reviewProgress(db: PoolClient, who: Identity, world: ReviewWorld) {
  const decisions = await rows<ReviewDecision>(db,
    `select ${decisionColumns} from verification_reviews where profile=$1 and grade=$2 and bank_version=$3`,
    [who.profile, world.grade, world.version]);
  return Object.fromEntries(decisions.map(decision => [decision.id, decision]));
}

export async function reviewWorldSummaries(db: PoolClient, who: Identity) {
  const summaries = [];
  for (const grade of verificationGrades) {
    const { world } = verificationCatalog(grade);
    summaries.push({ grade, ...countReviews(world, await reviewProgress(db, who, world)) });
  }
  return summaries;
}

export async function saveReview(
  db: PoolClient,
  who: Identity,
  input: { grade?: unknown; version?: unknown; example?: unknown; raw?: unknown; status?: unknown; note?: unknown },
): Promise<ReviewDecision> {
  const { world, example } = currentExample(input);
  const cases = reviewCases(world);
  const index = cases.findIndex(item => item.id === input.example);
  const item = cases[index];
  const progress = await reviewProgress(db, who, world);
  if (progress[item.id]) return progress[item.id];
  if (cases.slice(0, index).some(prior => !progress[prior.id])) {
    throw new GameError("Review the earlier examples first.", 409);
  }

  let note: string | null = null;
  if (input.status === "accepted") {
    const marked = typeof input.raw === "string" && grade(example.control, example.answer, input.raw);
    if (!marked || marked.outcome !== "correct") {
      throw new GameError("Answer the example correctly before accepting it.", 422);
    }
  } else if (input.status === "flagged") {
    note = typeof input.note === "string" ? input.note.trim() : "";
    if (!note || note.length > 1500) throw new GameError("Describe the issue in 1–1,500 characters.", 422);
  } else {
    throw new GameError("Choose Accept problem or Report a bug.");
  }

  return one<ReviewDecision>(db,
    `insert into verification_reviews (profile,grade,bank_version,case_id,level_id,question_id,status,note,snapshot)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning ${decisionColumns}`,
    [who.profile, world.grade, world.version, item.id, item.level, item.questionId, input.status, note,
      JSON.stringify({ question: item.question, checklist: item.note, workedExample: item.workedExample })]);
}

export function exportReviewBugs(db: PoolClient, who: Identity) {
  return rows(db,
    `select grade,bank_version as "bankVersion",level_id as "levelId",question_id as "questionId",
       saved_at as "reportedAt",note,snapshot from verification_reviews
       where profile=$1 and status='flagged' order by saved_at,grade,case_id`,
    [who.profile]);
}
