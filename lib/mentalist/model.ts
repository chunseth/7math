import sixth from "../../content/6math/lessons.json";
import eighth from "../../content/8math/lessons.json";
import skillData from "../../content/mentalist/skills.json";
import lessonPlan from "../../content/mentalist/lesson-plan.json";
import trailData from "../../content/mentalist/trail.json";
import { branchTitles } from "../curriculum/catalog";
import { equal, formatRational, parseAnswer } from "../curriculum/rational";
import type { Equipment } from "./resources";

// Keep each slash on the word before it, with a space before the next word ("Bar/ dot plots").
const spaceSlashes = (title: string) => title.replace(/\s*\/\s*/g, "/ ");
export const skills = skillData.map((skill) => ({
  ...skill,
  title: spaceSlashes(skill.title),
  levels: skill.levels.map(spaceSlashes),
}));
export const levels: Level[] = trailData.map((level) => ({ ...level, title: spaceSlashes(level.title) }));
export type CourseGrade = 6 | 7 | 8;
export const courseGrade = (value: unknown): CourseGrade => value === 6 || value === 8 ? value : 7;
export const gradeOf = (id: string): CourseGrade => id.startsWith("g6.") ? 6 : id.startsWith("g8.") ? 8 : 7;

type CourseLesson = {
  id: string;
  title: string;
  unit: string;
  example: string;
  standards: string[];
  prerequisites: string[];
  stages?: { title: string; example: string }[];
  previousPrerequisites?: string[];
};
function makeCourse(lessons: CourseLesson[], grade: 6 | 8) {
  const skills = lessons.map(lesson => ({
    ...lesson, group: lesson.id, levels: lesson.stages?.map(s => s.title) ?? [lesson.title], world: `g${grade}.${lesson.unit}`,
  }));
  const levels: Level[] = skills.flatMap(skill => skill.levels.map((title, i) => ({
    id: skill.id + "." + (i+1), skill: skill.id, title, ordinal: i+1,
    preview: { prompt: skill.stages?.[i].example ?? skill.example },
  })));
  return { skills, levels };
}
export const courses = { 6: makeCourse(sixth, 6), 8: makeCourse(eighth, 8) };
const originalParents = new Map([...courses[6].skills, ...courses[8].skills].map(s => [s.id, s.previousPrerequisites]));
export const { skills: grade8Skills, levels: grade8Levels } = courses[8];
const courseSkills = [...courses[6].skills, ...grade8Skills];
export const worldTitles = branchTitles;
export const worlds = [...new Set(skills.map((s) => s.world))];
export const skillById = new Map<string, (typeof skills)[number]>([...skills, ...courseSkills].map(s => [s.id, s]));
export const levelById = new Map([...levels, ...courses[6].levels, ...grade8Levels].map(l => [l.id, l]));
export const curriculumVersion = 5;
const formerSkillIds = new Map<string, string>();
for (const skill of skills)
  for (const table of skill.tables ?? []) formerSkillIds.set(skill.group + "." + table, skill.id);

export const currentSkill = (id: string) => formerSkillIds.get(id) ?? id;
export function currentLevel(id: string) {
  const ordinal = id.lastIndexOf(".");
  return currentSkill(id.slice(0, ordinal)) + id.slice(ordinal);
}
export const cardTitles: Record<string, string> = {
  ...Object.fromEntries(courseSkills.map(skill => [skill.world, skill.unit])),
  ...worldTitles, multiplication: "Multiplication", division: "Division",
};
export function cardTopic(skillId: string) {
  const skill = skillById.get(currentSkill(skillId));
  if (!skill) throw new Error("Unknown card skill: " + skillId);
  if (skill.group === "review.multiply") return "multiplication";
  if (skill.group === "review.divide") return "division";
  return skill.world;
}
export const lessonStops = lessonPlan.map(([id]) => ({
  title: skillById.get(id)!.title,
  levels: levels.filter(level => level.skill === id),
}));
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
  review: "review.multiply.8-9.1",
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
  sampleSize?: number;
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
  fields?: { label: string; options: string[]; entry?: "number" | "text" }[];
  limit?: number;
  step?: number;
  origin?: number;
  points?: number;
};
type ResponseField = NonNullable<Control["fields"]>[number];
export function responseFieldMode(kind: string, field: ResponseField, index: number) {
  if (field.entry) return field.entry;
  if (kind === "ray") return index === 0 ? "number" : "buttons";
  if (kind === "net") return index === 2 ? "number" : "buttons";
  if (kind === "list" || kind === "tree") return "buttons";
  if (["boxplot", "record", "simulation", "table"].includes(kind) && field.options.every(value => parseAnswer(value))) return "number";
  return "select";
}

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
  missingEvidence?: string[];
};
export function evaluate(positions: Recorded[][], targetMs: number, evidence: (string | undefined)[] = []): Result | null {
  if (positions.length !== 12 || positions.some((events) => events.at(-1)?.outcome !== "correct"))
    return null;
  const events = positions.flat(),
    scored = events.filter((e) => e.outcome !== "simplification");
  const correctFirst = positions.map(
    (group) => group.find((e) => e.outcome !== "simplification")?.outcome === "correct",
  );
  const firstTry = correctFirst.filter(Boolean).length;
  const demonstrated = new Set(evidence.filter((_, index) => correctFirst[index]));
  const missingEvidence = [...new Set(evidence.filter((name): name is string => !!name && !demonstrated.has(name)))];
  const times = positions.map(group => group.every(e => e.active_ms !== null)
    ? group.reduce((sum, e) => sum + e.active_ms!, 0)
    : null);
  const timed = times.filter((ms): ms is number => ms !== null);
  const activeMs = timed.length === 12 ? timed.reduce((sum, ms) => sum + ms, 0) : null;
  const retries = scored.length - 12;
  const passed = firstTry >= 10 && missingEvidence.length === 0;
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
    ...(missingEvidence.length ? { missingEvidence } : {}),
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
    if (c.kind === "stem-plot" && !parts.some(Boolean)) return false;
    return parts.length === c.fields.length && c.fields.every((field, i) => {
      if (c.kind === "dotplot" || c.kind === "histogram") return /^\d{1,2}$/.test(parts[i]);
      if (c.kind === "stem-plot") return /^(?:\d(?: \d){0,11})?$/.test(parts[i]);
      const mode = responseFieldMode(c.kind, field, i);
      if (mode === "number") return !!parseAnswer(parts[i]);
      if (mode === "text") return /^[a-z]{1,3}$/i.test(parts[i].trim());
      return field.options.includes(parts[i]);
    });
  }
  if (c.limit) {
    const points = raw.split(";");
    if (points.length !== (c.points ?? 1)) return false;
    const step = Math.round((c.step ?? 1) * 10);
    const origin = Math.round((c.origin ?? 0) * 10);
    const onGrid = (offset: number) => offset % step === 0 && Math.abs(offset / step) <= c.limit!;
    return points.every((pair) => {
      if (!/^-?\d{1,2}(?:\.\d)?,-?\d{1,2}(?:\.\d)?$/.test(pair)) return false;
      const [x, y] = pair.split(",").map(value => Math.round(Number(value) * 10));
      return onGrid(x - origin) && onGrid(y) && (c.kind !== "line" || y === 0);
    });
  }
  return false;
}
export function normalizeStructuredAnswer(c: Control, raw: string) {
  if (c.kind === "line" && c.origin !== undefined) return raw.split(",").map(Number).join(",");
  // A rectangle placed at the origin may extend into any quadrant if the prompt gives only its dimensions.
  if (c.kind === "drawing") return raw.split(",").map(value => Math.abs(Number(value))).join(",");
  if (c.kind === "scatterplot") {
    return raw.split(";").map(pair => pair.split(",").map(Number).join(",")).sort().join(";");
  }
  if (c.fields) {
    const parts = raw.split("|");
    return parts.map((part, i) => {
      const field = c.fields?.[i];
      if (!field || field.options.includes(part)) return part;
      const mode = responseFieldMode(c.kind, field, i);
      if (mode === "text") return part.trim().toLowerCase();
      if (mode !== "number") return part;
      const value = parseAnswer(part);
      return value ? field.options.find(option => {
        const equivalent = parseAnswer(option);
        return equivalent && equal(value, equivalent);
      }) ?? part : part;
    }).join("|");
  }
  return raw;
}
export function grade(
  c: Control,
  answer: string,
  raw: string,
): { outcome: Outcome; normalized: string } | null {
  if (!complete(c, raw)) return null;
  if (!["whole", "decimal", "fraction"].includes(c.kind)) {
    const normalized = normalizeStructuredAnswer(c, raw);
    return { outcome: normalizeStructuredAnswer(c, answer) === normalized ? "correct" : "incorrect", normalized };
  }
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
  path: Level[] = levels,
): Access[] {
  const passed = new Map(clears.map((c) => [c.level, c]));
  const finished = (id: string) =>
    placed.has(id) || skillById.get(id)!.levels.every((_, i) => passed.has(`${id}.${i + 1}`));
  // A site can deploy the new app before publishing the expanded question bank.
  const prefix = path[0] && "g" + gradeOf(path[0].id);
  const originalCourse = published.has(prefix + ".sets.1") && !published.has(prefix + ".steps-sets.1");
  return path.map((l) => {
    const skill = skillById.get(l.skill)!;
    const entry: Access = { id: l.id, state: "ready", reason: "Ready to play", stars: 0 };
    if (!published.has(l.id)) return { ...entry, state: "planned", reason: "Awaiting publication" };
    const clear = passed.get(l.id);
    if (clear) return { ...entry, state: "cleared", reason: "Cleared", stars: clear.stars };
    const previous = `${l.skill}.${l.ordinal - 1}`;
    if (l.ordinal > 1 && !passed.has(previous))
      return { ...entry, state: "locked", reason: `Clear ${levelById.get(previous)!.title} first` };
    const requirements = originalCourse
      ? originalParents.get(l.skill) ?? skill.prerequisites : skill.prerequisites;
    const missing = requirements.filter((id) => !finished(id));
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
export function mainPathProgress(access: Access[], path = mainPathLevels): MainPathProgress {
  const byId = new Map(access.map((entry) => [entry.id, entry]));
  const published = path.filter((level) => {
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
  equipment: Equipment;
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
