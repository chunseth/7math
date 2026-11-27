import { fieldCheckText, fieldValue, grade, gradeQuestion, isFieldAttempt, normalizeStructuredAnswer, parseFieldAttempt, type Outcome, type Question, type RunView } from "./model";
import { formatRational, parseAnswer } from "../curriculum/rational";
import { responseForGrade } from "./least-order";

export type PackedQuestion = Question & { check: string };
export type LevelPack = { level: string; set: string; questions: PackedQuestion[]; mix?: string[] };
export type RoundRules = { order: number[]; hits: number[]; missDamage: number; enemyHealth: number };
export type StartedRound = RunView & { rules: RoundRules };
export type Attempt = { raw: string; elapsed: number; at: number };
export type RoundDraft = {
  run: StartedRound;
  pack: LevelPack;
  attempts: Attempt[];
  started: number;
  activeMs: number;
  save: "finish" | "leave" | null;
};

export function checkText(set: string, index: number, q: Question, answer: string) {
  const value = ["whole", "fraction", "decimal"].includes(q.control.kind) ? parseAnswer(answer) : null;
  return JSON.stringify([set, index, value ? formatRational(value) : normalizeStructuredAnswer(q.control, answer)]);
}

export async function checkLocally(pack: LevelPack, index: number, raw: string): Promise<Outcome> {
  const q = pack.questions[index];
  if (q.visual?.coinTrials) {
    const marked = gradeQuestion(q, "", raw);
    if (!marked) throw new Error("Finish the coin trial before checking it.");
    return marked.outcome;
  }
  if (isFieldAttempt(raw)) {
    const attempt = parseFieldAttempt(q.control, raw);
    if (!attempt || !q.fieldChecks || await checkField(q, attempt.index, attempt.value))
      throw new Error("The part is incomplete.");
    return "incorrect";
  }
  const response = responseForGrade(q, raw);
  const marked = response !== null && grade(q.control, response, response);
  if (response === null || !marked) throw new Error("Finish your answer before checking it.");
  const hex = await digest(checkText(pack.set, index, q, response));
  return hex === q.check ? marked.outcome : "incorrect";
}

export async function checkField(question: Question, index: number, raw: string) {
  const value = fieldValue(question.control, index, raw);
  return value !== null && await digest(fieldCheckText(question.prompt, index, value)) === question.fieldChecks?.[index];
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function guestOrder(pack: LevelPack) {
  const shuffle = (indices: number[]) => {
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  };
  const indices = pack.questions.map((_, index) => index);
  if (!pack.mix) return shuffle(indices);
  const groups = new Map<string, number[]>();
  for (const [i, category] of pack.mix.entries()) {
    const group = groups.get(category) ?? [];
    group.push(i);
    groups.set(category, group);
  }
  const halves = [[], []] as [number[], number[]];
  for (const group of groups.values()) {
    const middle = group.length / 2;
    shuffle(group);
    halves[0].push(...group.slice(0, middle));
    halves[1].push(...group.slice(middle));
  }
  return [...shuffle(halves[0]), ...shuffle(halves[1])];
}

type Combat = Pick<RunView, "hp" | "enemy_hp" | "defeats" | "resolved">;
export function advance(state: Combat, rules: RoundRules, outcome: Outcome): Combat {
  let { hp, enemy_hp, defeats, resolved } = state;
  if (outcome === "incorrect") hp = Math.max(0, hp - rules.missDamage);
  if (outcome === "correct") {
    enemy_hp -= rules.hits[resolved];
    resolved++;
    if (enemy_hp <= 0) {
      enemy_hp = rules.enemyHealth;
      defeats++;
    }
  }
  return { hp, enemy_hp, defeats, resolved };
}
