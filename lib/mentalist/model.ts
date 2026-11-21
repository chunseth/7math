import skillData from "../../content/mentalist/skills.json";
import lessonPlan from "../../content/mentalist/lesson-plan.json";
import trailData from "../../content/mentalist/trail.json";
import { branchTitles } from "../curriculum/catalog";
import { equal, formatRational, parseAnswer } from "../curriculum/rational";

export const skills = skillData;
export const levels: Level[] = trailData;
export const worldTitles = branchTitles;
export const worlds = [...new Set(skills.map((s) => s.world))];
export const skillById = new Map(skills.map((s) => [s.id, s]));
export const levelById = new Map(levels.map((l) => [l.id, l]));
export const lessonStops = lessonPlan.map((ids) => {
  const first = skillById.get(ids[0])!;
  const title = ids.length === 1 ? first.title :
    first.title.replace(/\d+$/, "") + new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(ids.map(id => id.split(".").pop()!));
  return { title, levels: ids.flatMap(id => levels.filter(level => level.skill === id)) };
});
export const mainPathLevels = lessonStops.flatMap(stop => stop.levels);
export const sprites = [
  "raijin",
  "phoenix",
  "pooka",
  "long",
  "banshee",
  "skinwalker",
  "nian",
  "jormungandr",
  "simurgh",
  "naga",
  "hydra",
  "garuda",
  "pegasus",
  "anubis",
  "valkyrie",
  "oni",
  "horus",
  "griffin",
  "chupacabra",
  "fenrir",
  "minotaur",
  "kitsune",
  "seraph",
  "sphynx",
  "quetzalcoatl",
];
export const checkpoint = {
  level: "signed.add.2",
  review: "review.multiply.9.1",
  expiry: "signed.add.3",
  coins: 25,
};
export type Visual = {
  kind: string;
  values?: number[];
  labels?: string[];
  headers?: string[];
  rows?: (string | number)[][];
  points?: number[][];
  outcomes?: string[];
  solid?: number;
  source?: string;
};
export type Level = {
  id: string;
  skill: string;
  title: string;
  ordinal: number;
  preview: { prompt: string; visual?: Visual };
};
export type Control = {
  kind: string;
  signed?: boolean;
  width?: number;
  places?: number;
  options?: string[];
  fields?: { label: string; options: string[] }[];
  limit?: number;
  step?: number;
  points?: number;
};
export type Question = { prompt: string; control: Control; visual?: Visual };
export type Outcome = "incorrect" | "correct" | "simplification";
export type Recorded = { outcome: Outcome; active_ms: number | null };
export type Result = {
  firstTry: number;
  passed: boolean;
  stars: number;
  correct: number;
  scored: number;
  attemptAccuracy: number;
  activeMs: number | null;
  fastestProblemMs: number | null;
  targetMs: number;
  retries: number;
  simplifications: number;
};
export function evaluate(positions: Recorded[][], targetMs: number): Result | null {
  if (positions.length !== 12 || positions.some((events) => events.at(-1)?.outcome !== "correct"))
    return null;
  const events = positions.flat(),
    scored = events.filter((e) => e.outcome !== "simplification");
  const firstTry = positions.filter(
    (group) => group.find((e) => e.outcome !== "simplification")?.outcome === "correct",
  ).length;
  const times = positions.map(group => group.every(e => e.active_ms !== null)
    ? group.reduce((sum, e) => sum + e.active_ms!, 0)
    : null);
  const timed = times.filter((ms): ms is number => ms !== null);
  const activeMs = timed.length === 12 ? timed.reduce((sum, ms) => sum + ms, 0) : null;
  const retries = scored.length - 12;
  const passed = firstTry >= 10;
  return {
    firstTry,
    passed,
    stars: passed
      ? 1 +
        Number(retries <= 1 && activeMs !== null && activeMs <= 1.5 * targetMs) +
        Number(retries === 0 && activeMs !== null && activeMs <= targetMs)
      : 0,
    correct: 12,
    scored: scored.length,
    attemptAccuracy: 12 / scored.length,
    activeMs,
    fastestProblemMs: activeMs === null ? null : Math.min(...timed),
    targetMs,
    retries,
    simplifications: events.length - scored.length,
  };
}
export function complete(c: Control, raw: string) {
  if (!raw || raw.length > 256) return false;
  if (c.kind === "fraction")
    return /^-?\d{1,12}\/-?\d{1,12}$/.test(raw) && !!parseAnswer(raw) && (c.signed || !raw.startsWith("-"));
  if (c.kind === "whole" || c.kind === "decimal") {
    const decimal = c.places ? `\\.\\d{${c.places}}` : "";
    return new RegExp(`^${c.signed ? "-?" : ""}\\d{${c.width}}${decimal}$`).test(raw);
  }
  if (c.options) return c.options.includes(raw);
  if (c.fields) {
    const parts = raw.split("|");
    return parts.length === c.fields.length && c.fields.every((field, i) => field.options.includes(parts[i]));
  }
  if (c.limit) {
    const points = raw.split(";");
    if (points.length !== (c.points ?? 1)) return false;
    const step = c.step ?? 1,
      limit = c.limit;
    return points.every((pair) => {
      if (!/^-?\d{1,2}(?:\.5)?,-?\d{1,2}(?:\.5)?$/.test(pair)) return false;
      const [x, y] = pair.split(",").map(Number);
      return (
        [x, y].every((v) => Number.isInteger(v / step) && Math.abs(v / step) <= limit) &&
        (c.kind !== "line" || y === 0)
      );
    });
  }
  return false;
}
export function grade(
  c: Control,
  answer: string,
  raw: string,
): { outcome: Outcome; normalized: string } | null {
  if (!complete(c, raw)) return null;
  if (!["whole", "decimal", "fraction"].includes(c.kind))
    return { outcome: answer === raw ? "correct" : "incorrect", normalized: raw };
  const value = parseAnswer(raw),
    expected = parseAnswer(answer);
  if (!value || !expected) return null;
  const normalized = formatRational(value);
  if (!equal(value, expected)) return { outcome: "incorrect", normalized };
  if (c.kind === "fraction") {
    const [n, d] = raw.split("/").map(BigInt);
    if (n !== value.numerator || d !== value.denominator) return { outcome: "simplification", normalized };
  }
  return { outcome: "correct", normalized };
}
export type Access = {
  id: string;
  state: "ready" | "progress" | "cleared" | "placed" | "locked" | "planned";
  reason: string;
  stars: number;
};
export type Progress = { level: string; stars: number; review_due: string };
export function accessMap(
  published: Set<string>,
  clears: Progress[],
  played: Set<string>,
  assigned: Set<string>,
  placed: Set<string>,
): Access[] {
  const passed = new Map(clears.map((c) => [c.level, c]));
  const finished = (id: string) =>
    placed.has(id) || skillById.get(id)!.levels.every((_, i) => passed.has(`${id}.${i + 1}`));
  return levels.map((l) => {
    const skill = skillById.get(l.skill)!;
    const entry: Access = { id: l.id, state: "ready", reason: "Ready to play", stars: 0 };
    if (!published.has(l.id)) return { ...entry, state: "planned", reason: "Awaiting publication" };
    const clear = passed.get(l.id);
    if (clear) return { ...entry, state: "cleared", reason: "Cleared", stars: clear.stars };
    const previous = `${l.skill}.${l.ordinal - 1}`;
    if (l.ordinal > 1 && !passed.has(previous))
      return { ...entry, state: "locked", reason: `Clear ${levelById.get(previous)!.title} first` };
    const missing = skill.prerequisites.filter((id) => !finished(id));
    if (missing.length && !placed.has(l.skill))
      return {
        ...entry,
        state: "locked",
        reason: "Clear " + missing.map((id) => skillById.get(id)!.title).join(", "),
      };
    if (placed.has(l.skill)) return { ...entry, state: "placed", reason: "Teacher placement" };
    if (played.has(l.id)) return { ...entry, state: "progress", reason: "In progress" };
    return assigned.has(l.skill) ? { ...entry, reason: "Teacher assignment" } : entry;
  });
}
export const playable = (a: Access) => a.state !== "locked" && a.state !== "planned";
export type MainPathProgress = {
  cleared: number;
  total: number;
  target: string | null;
  next: string | null;
};
export function mainPathProgress(access: Access[]): MainPathProgress {
  const byId = new Map(access.map((entry) => [entry.id, entry]));
  const published = mainPathLevels.filter((level) => {
    const state = byId.get(level.id)?.state;
    return state !== undefined && state !== "planned";
  });
  const placed = new Set(access.filter(entry => entry.state === "placed").map(entry => levelById.get(entry.id)!.skill));
  const target = published.find(level => !placed.has(level.skill) && byId.get(level.id)?.state !== "cleared");
  const firstUnfinished = (skill: string) => {
    const first = skillById.get(skill)!.levels
      .map((_, index) => `${skill}.${index + 1}`)
      .find((id) => byId.get(id)?.state !== "cleared");
    return first && byId.get(first)?.state !== "placed" ? first : null;
  };
  const visited = new Set<string>();
  function nextAction(id: string): string | null {
    if (visited.has(id)) return null;
    visited.add(id);
    const entry = byId.get(id);
    if (!entry || entry.state === "planned") return null;
    if (playable(entry)) return id;
    const level = levelById.get(id)!;
    if (level.ordinal > 1) {
      const previous = `${level.skill}.${level.ordinal - 1}`;
      if (byId.get(previous)?.state !== "cleared") return nextAction(previous);
    }
    for (const prerequisite of skillById.get(level.skill)!.prerequisites) {
      const missing = firstUnfinished(prerequisite);
      if (missing) {
        const action = nextAction(missing);
        if (action) return action;
      }
    }
    return null;
  }
  return {
    cleared: published.filter((level) => byId.get(level.id)?.state === "cleared").length,
    total: published.length,
    target: target?.id ?? null,
    next: target ? nextAction(target.id) : null,
  };
}
export type RunView = {
  id: string;
  level: string;
  status: string;
  hp: number;
  enemy_hp: number;
  defeats: number;
  resolved: number;
  bonus: boolean;
  bonusPaid: boolean;
  next?: { level: string; reason: string };
  chest: boolean;
  result: Result | null;
  leaderboardRank?: number;
  encounter?: { id: string; revision: number; position: number; question: Question };
};
export type LevelRecord = {
  username: string;
  totalMs: number;
  fastestProblemMs: number;
  totalRank: number;
  problemRank: number;
};
export function formatRunTime(ms: number | null) {
  return ms == null ? "Unavailable" : (ms / 1000).toFixed(3) + " s";
}
export type StudentState = {
  profile: { id: string; username: string; sprite_name: string; coins: number; xp: number };
  access: Access[];
  recommendation: { level: string; reason: string } | null;
  cards: { skill: string; amount: number; upgrade: number }[];
  legacy: { number: number; level: number; card_count: number }[];
  chests: { id: string; slot: number; ready: string | null }[];
  quests: { id: string; name: string; count: number; goal: number; coins: number; claimed: boolean }[];
  offer: boolean;
  classes: { id: string; name: string }[];
  classId: string | null;
  ownedSprites: string[];
  legacySkills: { skill_id: string; card_count: number; level: number }[];
  activeRun: string | null;
  activeLevel: string | null;
  title: string | null;
  frame: string | null;
  clearedSkills: number;
};
