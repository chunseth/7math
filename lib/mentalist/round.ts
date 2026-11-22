import { grade, type Outcome, type Question, type RunView } from "./model";
import { formatRational, parseAnswer } from "../curriculum/rational";

export type PackedQuestion = Question & { check: string };
export type LevelPack = { level: string; set: string; questions: PackedQuestion[] };
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
  return JSON.stringify([set, index, value ? formatRational(value) : answer]);
}

export async function checkLocally(pack: LevelPack, index: number, raw: string): Promise<Outcome> {
  const q = pack.questions[index];
  const marked = grade(q.control, raw, raw);
  if (!marked) throw new Error("Finish your answer before checking it.");
  const bytes = new TextEncoder().encode(checkText(pack.set, index, q, raw));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hex = Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
  return hex === q.check ? marked.outcome : "incorrect";
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
