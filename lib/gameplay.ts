import progressionMap from "./progression-map.json";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export type PassCriteria = {
  minCorrect: number;
  minAccuracy: number;
  maxDamageTaken: number;
  chestRequiresCorrect: number;
};

export type DifficultyTuning = {
  waveSize: number;
  secondsPerProblem: number;
  shieldHits: number;
};

export type MultiplicationLevel = {
  id: string;
  title: string;
  mapNumbers: number[];
  focus: string;
  rarity: Rarity;
  passCriteria: PassCriteria;
  difficulty: DifficultyTuning;
};

export type Operation = "multiplication" | "addition" | "subtraction" | "division";

export type OperationArenaId = string;

export type OperationArena = {
  id: OperationArenaId;
  worldId: string;
  worldTitle: string;
  level: string;
  title: string;
  missionType: "practice" | "challenge" | "boss";
  operations: Operation[];
  focus: string;
  enemyCount: number;
  enemyHealthMultiplier: number;
  bossHealthMultiplier: number;
  rewardRarityChances: Record<Rarity, number>;
};

export const OPERATION_ARENAS: OperationArena[] = progressionMap.worlds.flatMap((world) =>
  progressionMap.levelTemplates.map((template) => ({
    id: `${world.id}-${template.suffix}`,
    worldId: world.id,
    worldTitle: world.title,
    level: template.suffix,
    title: `${world.title}-${template.suffix}: ${template.title}`,
    missionType: template.missionType as OperationArena["missionType"],
    operations: template.operations as Operation[],
    focus: template.focus,
    enemyCount: template.missionType === "boss" ? world.enemyCount + 1 : world.enemyCount,
    enemyHealthMultiplier: world.enemyHealthMultiplier,
    bossHealthMultiplier: template.bossHealthMultiplier ?? 1,
    rewardRarityChances: world.rewardRarityChances,
  })),
);

export function operationArenaById(id: string | null | undefined): OperationArena {
  const legacyAliases: Record<string, string> = {
    addition: "w1-1",
    "add-sub": "w1-2",
    multiplication: "w1-3",
    division: "w1-4",
    "mult-div": "w1-5",
    boss: "w1-B",
  };
  return OPERATION_ARENAS.find((arena) => arena.id === (id ? legacyAliases[id] ?? id : id)) ?? OPERATION_ARENAS[0];
}

export function nextOperationArena(currentId: string | null | undefined): OperationArena | null {
  const index = OPERATION_ARENAS.findIndex((arena) => arena.id === currentId);
  return index >= 0 ? OPERATION_ARENAS[index + 1] ?? null : OPERATION_ARENAS[0];
}

export function currentProgressionArena(completedLevelIds: string[]): OperationArena {
  const completed = new Set(completedLevelIds);
  return OPERATION_ARENAS.find((arena) => !completed.has(arena.id)) ?? OPERATION_ARENAS[OPERATION_ARENAS.length - 1];
}

export function isArenaUnlocked(arenaId: string, completedLevelIds: string[]): boolean {
  const arena = operationArenaById(arenaId);
  if (arena.id === OPERATION_ARENAS[0].id) return true;
  const prior = OPERATION_ARENAS[OPERATION_ARENAS.findIndex((entry) => entry.id === arena.id) - 1];
  return Boolean(prior && completedLevelIds.includes(prior.id));
}

export function enemyHpForArena(arena: OperationArena, enemyIndex: number): number {
  const normalHp = MONSTER_HP * arena.enemyHealthMultiplier;
  const isBossEnemy = arena.missionType === "boss" && enemyIndex === arena.enemyCount - 1;
  return isBossEnemy ? normalHp * arena.bossHealthMultiplier : normalHp;
}

/** All arenas in a world (e.g. w2-1 … w2-B), in progression order. */
export function arenasInWorld(worldId: string): OperationArena[] {
  return OPERATION_ARENAS.filter((arena) => arena.worldId === worldId);
}

/** Arena ids that count as progress for a world — used to wipe a world after a boss loss. */
export function worldArenaIds(worldId: string): string[] {
  return arenasInWorld(worldId).map((arena) => arena.id);
}

export type AdditionSkillDefinition = {
  id: string;
  title: string;
  description: string;
  prerequisiteId: string | null;
};

export type SkillDefinition = AdditionSkillDefinition;

export const ADDITION_SKILLS: AdditionSkillDefinition[] = [
  { id: "addition.single-digit", title: "Add Within 10", description: "Add two single-digit numbers with a sum up to 10.", prerequisiteId: null },
  { id: "addition.doubles", title: "Doubles", description: "Add a number to itself.", prerequisiteId: "addition.single-digit" },
  { id: "addition.near-doubles", title: "Near Doubles", description: "Use a known double to add neighboring numbers.", prerequisiteId: "addition.doubles" },
  { id: "addition.make-ten", title: "Make Ten", description: "Compose ten to solve addition facts.", prerequisiteId: "addition.near-doubles" },
  { id: "addition.eleven-twenty", title: "Add Within 20", description: "Add with sums from 11 through 20.", prerequisiteId: "addition.make-ten" },
  { id: "addition.three", title: "Add Three Numbers", description: "Combine three addends efficiently.", prerequisiteId: "addition.eleven-twenty" },
  { id: "addition.ten-multiples", title: "Add Multiples of Ten", description: "Add tens through 100.", prerequisiteId: "addition.three" },
  { id: "addition.simple-two-digit", title: "Two-Digit Addition", description: "Add two-digit numbers without regrouping.", prerequisiteId: "addition.ten-multiples" },
  { id: "addition.regrouping-ones", title: "Regroup Ones", description: "Regroup ten ones into one ten.", prerequisiteId: "addition.simple-two-digit" },
  { id: "addition.two-digit", title: "Two-Digit With Regrouping", description: "Add two-digit numbers with regrouping.", prerequisiteId: "addition.regrouping-ones" },
];

export const STARTER_ADDITION_SKILL_ID = ADDITION_SKILLS[0].id;
export const SUBTRACTION_SKILLS: SkillDefinition[] = [
  { id: "subtraction.within-ten", title: "Subtract Within 10", description: "Subtract two single-digit numbers without going below zero.", prerequisiteId: null },
  { id: "subtraction.zero", title: "Subtract Zero", description: "Use the identity rule when taking away zero.", prerequisiteId: "subtraction.within-ten" },
  { id: "subtraction.from-ten", title: "Subtract From Ten", description: "Fluently subtract numbers from ten.", prerequisiteId: "subtraction.zero" },
  { id: "subtraction.fact-families", title: "Fact Families", description: "Connect addition facts to related subtraction facts.", prerequisiteId: "subtraction.from-ten" },
  { id: "subtraction.within-twenty", title: "Subtract Within 20", description: "Subtract single-digit numbers from teen numbers.", prerequisiteId: "subtraction.fact-families" },
  { id: "subtraction.ten-multiples", title: "Subtract Multiples of Ten", description: "Subtract tens through 100.", prerequisiteId: "subtraction.within-twenty" },
  { id: "subtraction.simple-two-digit", title: "Two-Digit Subtraction", description: "Subtract two-digit numbers without regrouping.", prerequisiteId: "subtraction.ten-multiples" },
  { id: "subtraction.regrouping-ones", title: "Regroup Ones", description: "Trade one ten for ten ones to subtract.", prerequisiteId: "subtraction.simple-two-digit" },
  { id: "subtraction.two-digit", title: "Two-Digit With Regrouping", description: "Subtract two-digit numbers with regrouping.", prerequisiteId: "subtraction.regrouping-ones" },
  { id: "subtraction.mixed", title: "Mixed Subtraction", description: "Choose an efficient subtraction strategy.", prerequisiteId: "subtraction.two-digit" },
];
export const STARTER_SUBTRACTION_SKILL_ID = SUBTRACTION_SKILLS[0].id;

/** Division uses the same row-card model as multiplication; zero is excluded. */
export const DIVISION_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);

export const SKILLS_BY_OPERATION: Record<"addition" | "subtraction", SkillDefinition[]> = {
  addition: ADDITION_SKILLS,
  subtraction: SUBTRACTION_SKILLS,
};

export const STARTER_SKILL_ID: Record<"addition" | "subtraction", string> = {
  addition: STARTER_ADDITION_SKILL_ID,
  subtraction: STARTER_SUBTRACTION_SKILL_ID,
};
export const MASTERY_ATTEMPTS = 10;
export const MASTERY_ACCURACY = 0.8;

export type Problem = {
  id: string;
  operation: Operation;
  skillId: string;
  operandA: number;
  operandB: number;
  operandC: number | null;
  answer: number;
  levelId: string;
  threat: "scout" | "shield" | "fast" | "boss";
  secondsAllowed: number;
};

export const STARTING_UNLOCKED_NUMBERS = [3, 4, 5, 6];
export const FIRST_GAME_QUESTION_COUNT = 6;
export const FIRST_GAME_SECONDS_PER_PROBLEM = 5;
export const COMPLETE_MULTIPLICATION_MAP = Array.from({ length: 13 }, (_, number) => number);

export const chestRarityWeights: Record<Rarity, number> = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 3,
};

export const chestNumberPools: Record<Rarity, number[]> = {
  common: [7, 8, 9],
  rare: [11, 12],
  epic: [10, 2],
  legendary: [0, 1],
};

// ----------------------------------------------------------------------------
// Combat engine
//
// Player damage to a monster is based on the higher level of the two numbers in
// the problem, rolled fresh each hit. Monsters damage the player only on a miss
// (wrong answer or timeout): a flat 25% of max health, with a 20% chance to crit
// for double. See unit-1-mini-clash-multiplication.md > Combat.
// ----------------------------------------------------------------------------

export type NumberLevel = 1 | 2 | 3 | 4;

export const MAX_NUMBER_LEVEL: NumberLevel = 4;
export const MAX_SKILL_LEVEL = MAX_NUMBER_LEVEL;
export const CARDS_PER_LEVEL = 40;
export const GOLD_PER_LEVEL = 2000;
export const MAX_CARD_COUNT = 999;

export function clampCardCount(count: number) {
  return Math.min(MAX_CARD_COUNT, Math.max(0, Math.floor(count)));
}

export const MONSTER_HP = 10;
export const BOSS_HP = 40;

export const PLAYER_MAX_HEALTH = 100;
export const MISS_HEALTH_FRACTION = 0.25; // 25% of max health per miss -> 4 misses = death
export const CRIT_CHANCE = 0.2;
export const CRIT_MULTIPLIER = 2;

// Boss arena pulse: unavoidable cadence hits scaled by the speed milestone ladder.
// Softened vs miss damage (21% / 10% crit) because these land even on correct play.
export const BOSS_HIT_HEALTH_FRACTION = 0.21;
export const BOSS_CRIT_CHANCE = 0.1;
/** Warmup-tier gap between boss pulses; skilled tiers compress this via rampMultiplier. */
export const BOSS_PULSE_BASE_SECONDS = 10;
export const BOSS_PULSE_MIN_SECONDS = 3.5;

// Fresh damage roll ranges per number level, inclusive on both ends.
export const DAMAGE_RANGES: Record<NumberLevel, readonly [number, number]> = {
  1: [4, 8],
  2: [8, 12],
  3: [12, 18],
  4: [20, 25],
};

type Rng = () => number;

function clampLevel(level: number): NumberLevel {
  if (level <= 1) return 1;
  if (level >= 4) return 4;
  return level as NumberLevel;
}

export function damageRangeForLevel(level: number): readonly [number, number] {
  return DAMAGE_RANGES[clampLevel(level)];
}

// Random integer in [min, max] inclusive.
export function rollDamage(level: number, rng: Rng = Math.random): number {
  const [min, max] = damageRangeForLevel(level);
  return min + Math.floor(rng() * (max - min + 1));
}

// A hit uses the higher level of the two factors in the equation.
export function higherLevel(levelA: number, levelB: number): NumberLevel {
  return clampLevel(Math.max(levelA, levelB));
}

// Roll the damage a correct answer deals, off the higher-level factor.
export function rollProblemDamage(levelA: number, levelB: number, rng: Rng = Math.random): number {
  return rollDamage(higherLevel(levelA, levelB), rng);
}

export function multiplicationSkillId(number: number) {
  return `multiplication.row.${number}`;
}

export function divisionSkillId(number: number) {
  return `division.row.${number}`;
}

export function operationForSkillId(skillId: string): Operation {
  if (skillId.startsWith("addition.")) return "addition";
  if (skillId.startsWith("subtraction.")) return "subtraction";
  if (skillId.startsWith("division.")) return "division";
  return "multiplication";
}

export function monsterHpForThreat(threat: Problem["threat"]): number {
  return threat === "boss" ? BOSS_HP : MONSTER_HP;
}

export type MissResult = {
  isCrit: boolean;
  damage: number;
  remainingHealth: number;
};

// Resolve a miss against the player. Damage is a flat fraction of max health,
// doubled on a crit. remainingHealth never drops below 0.
export function resolveMiss(currentHealth: number, rng: Rng = Math.random): MissResult {
  const isCrit = rng() < CRIT_CHANCE;
  const base = Math.round(PLAYER_MAX_HEALTH * MISS_HEALTH_FRACTION);
  const damage = isCrit ? base * CRIT_MULTIPLIER : base;
  return { isCrit, damage, remainingHealth: Math.max(0, currentHealth - damage) };
}

// Resolve a boss pulse hit. Softer and less swingy than a miss, because the
// pulse fires on a skill-scaled timer even when the student is answering well.
export function resolveBossHit(currentHealth: number, rng: Rng = Math.random): MissResult {
  const isCrit = rng() < BOSS_CRIT_CHANCE;
  const base = Math.round(PLAYER_MAX_HEALTH * BOSS_HIT_HEALTH_FRACTION);
  const damage = isCrit ? base * CRIT_MULTIPLIER : base;
  return { isCrit, damage, remainingHealth: Math.max(0, currentHealth - damage) };
}

// Whether a number can be leveled up given its current cards and the player's coins.
export function canLevelUp(level: number, cardCount: number, coins: number): boolean {
  return level < MAX_NUMBER_LEVEL && cardCount >= CARDS_PER_LEVEL && coins >= GOLD_PER_LEVEL;
}

// ----------------------------------------------------------------------------
// Profile XP leveling
//
// profiles.xp is total cumulative XP. Level is derived from these thresholds:
// PROFILE_XP_TO_NEXT[level] = XP needed while at `level` to reach level+1.
// Cap is MAX_PROFILE_LEVEL; further XP still accumulates but does not raise level.
// ----------------------------------------------------------------------------

export const MAX_PROFILE_LEVEL = 20;

/** XP required to advance from level N to N+1. Index matches level (1–19). */
export const PROFILE_XP_TO_NEXT: Readonly<Record<number, number>> = {
  1: 150,
  2: 175,
  3: 200,
  4: 250,
  5: 300,
  6: 350,
  7: 425,
  8: 500,
  9: 600,
  10: 700,
  11: 850,
  12: 1000,
  13: 1200,
  14: 1400,
  15: 1650,
  16: 1950,
  17: 2300,
  18: 2700,
  19: 3200,
};

export function getProfileLevelFromXp(totalXp: number): number {
  let remaining = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < MAX_PROFILE_LEVEL) {
    const need = PROFILE_XP_TO_NEXT[level];
    if (need === undefined || remaining < need) break;
    remaining -= need;
    level += 1;
  }
  return level;
}

export type ProfileXpProgress = {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  isMax: boolean;
};

export function getProfileXpProgress(totalXp: number): ProfileXpProgress {
  let remaining = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < MAX_PROFILE_LEVEL) {
    const need = PROFILE_XP_TO_NEXT[level];
    if (need === undefined || remaining < need) {
      return { level, xpIntoLevel: remaining, xpForNext: need ?? 0, isMax: false };
    }
    remaining -= need;
    level += 1;
  }
  return { level: MAX_PROFILE_LEVEL, xpIntoLevel: remaining, xpForNext: 0, isMax: true };
}

export const multiplicationLevels: MultiplicationLevel[] = [
  {
    id: "unit-1.tables-3-6",
    title: "First Arena",
    mapNumbers: [3, 4, 5, 6],
    focus: "Mixed 3, 4, 5, and 6 facts",
    rarity: "common",
    passCriteria: { minCorrect: 8, minAccuracy: 0.7, maxDamageTaken: 40, chestRequiresCorrect: 1 },
    difficulty: { waveSize: 12, secondsPerProblem: 5, shieldHits: 1 },
  },
  {
    id: "unit-1.upper-rows",
    title: "Upper Rows",
    mapNumbers: [3, 4, 5, 6, 7, 8, 9],
    focus: "Adds the 7, 8, and 9 rows — the hard core of the times table",
    rarity: "common",
    passCriteria: { minCorrect: 10, minAccuracy: 0.75, maxDamageTaken: 35, chestRequiresCorrect: 1 },
    difficulty: { waveSize: 14, secondsPerProblem: 5, shieldHits: 1 },
  },
  {
    id: "unit-1.upper-facts",
    title: "Upper Facts",
    mapNumbers: [3, 4, 5, 6, 7, 8, 9, 11, 12],
    focus: "Adds 11s and 12s for stronger fluency",
    rarity: "rare",
    passCriteria: { minCorrect: 12, minAccuracy: 0.8, maxDamageTaken: 30, chestRequiresCorrect: 1 },
    difficulty: { waveSize: 16, secondsPerProblem: 4.5, shieldHits: 2 },
  },
  {
    id: "unit-1.full-map",
    title: "Full Map Clash",
    mapNumbers: COMPLETE_MULTIPLICATION_MAP,
    focus: "Mixed 0-12 multiplication mastery",
    rarity: "legendary",
    passCriteria: { minCorrect: 16, minAccuracy: 0.85, maxDamageTaken: 25, chestRequiresCorrect: 1 },
    difficulty: { waveSize: 20, secondsPerProblem: 4, shieldHits: 2 },
  },
];

export function getAvailableLevel(unlockedNumbers: number[]) {
  const unlocked = new Set([...STARTING_UNLOCKED_NUMBERS, ...unlockedNumbers]);
  return (
    [...multiplicationLevels]
      .reverse()
      .find((level) => level.mapNumbers.every((number) => unlocked.has(number))) ?? multiplicationLevels[0]
  );
}

/** Every unlocked number joins practice immediately — not gated on completing a full level tier. */
export function selectPracticeNumbers(unlockedNumbers: number[]) {
  return Array.from(new Set([...STARTING_UNLOCKED_NUMBERS, ...unlockedNumbers])).sort((a, b) => a - b);
}

function pickFactor(pool: number[], rng: () => number) {
  return pool[Math.floor(rng() * pool.length)] ?? STARTING_UNLOCKED_NUMBERS[0];
}

export function buildWave(unlockedNumbers: number[], level = getAvailableLevel(unlockedNumbers), rng: () => number = Math.random): Problem[] {
  const pool = selectPracticeNumbers(unlockedNumbers);

  return Array.from({ length: level.difficulty.waveSize }, (_, index) => {
    const factorA = pickFactor(pool, rng);
    const factorB = pickFactor(pool, rng);
    const isBoss = index === level.difficulty.waveSize - 1;
    const isShield = !isBoss && level.difficulty.shieldHits > 1 && index % 5 === 3;
    const isFast = !isBoss && index % 4 === 2;

    return {
      id: `${level.id}-${index}-${factorA}x${factorB}`,
      operation: "multiplication",
      skillId: multiplicationSkillId(factorA),
      operandA: factorA,
      operandB: factorB,
      operandC: null,
      answer: factorA * factorB,
      levelId: level.id,
      threat: isBoss ? "boss" : isShield ? "shield" : isFast ? "fast" : "scout",
      secondsAllowed: isFast ? Math.max(3, level.difficulty.secondsPerProblem - 1) : level.difficulty.secondsPerProblem,
    };
  });
}

/** Short play round drawn from all unlocked numbers (and starting 6–9). */
export function buildPracticeRound(
  unlockedNumbers: number[],
  unlockedAdditionSkills: string[] = [STARTER_ADDITION_SKILL_ID],
  unlockedSubtractionSkills: string[] = [STARTER_SUBTRACTION_SKILL_ID],
  unlockedDivisionNumbers: number[] = DIVISION_NUMBERS,
  questionCount = FIRST_GAME_QUESTION_COUNT,
  level = getAvailableLevel(unlockedNumbers),
  rng: () => number = Math.random,
): Problem[] {
  const pool = selectPracticeNumbers(unlockedNumbers);
  const pairs: Array<[number, number]> = [];

  for (const factorA of pool) {
    for (const factorB of pool) {
      pairs.push([factorA, factorB]);
    }
  }

  for (let index = pairs.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = pairs[index];
    pairs[index] = pairs[swapIndex];
    pairs[swapIndex] = current;
  }

  const multiplicationCount = Math.ceil(questionCount / 4);
  const selected = pairs.slice(0, Math.min(multiplicationCount, pairs.length));
  const multiplication = selected.map(([factorA, factorB], index): Problem => ({
    id: `${level.id}-round-${index}-${factorA}x${factorB}`,
    operation: "multiplication",
    skillId: multiplicationSkillId(factorA),
    operandA: factorA,
    operandB: factorB,
    operandC: null,
    answer: factorA * factorB,
    levelId: level.id,
    threat: "scout",
    secondsAllowed: level.difficulty.secondsPerProblem,
  }));
  const remaining = Math.max(0, questionCount - multiplication.length);
  const addition = Array.from({ length: Math.ceil(remaining / 3) }, (_, index) =>
    buildAdditionProblem(unlockedAdditionSkills, index, level.difficulty.secondsPerProblem, rng),
  );
  const subtraction = Array.from({ length: Math.floor(remaining / 3) }, (_, index) =>
    buildSubtractionProblem(unlockedSubtractionSkills, index, level.difficulty.secondsPerProblem, rng),
  );
  const division = Array.from({ length: Math.max(0, remaining - addition.length - subtraction.length) }, (_, index) =>
    buildDivisionProblem(unlockedDivisionNumbers, index, level.difficulty.secondsPerProblem, rng),
  );
  const mixed = [...multiplication, ...addition, ...subtraction, ...division];
  for (let index = mixed.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [mixed[index], mixed[swapIndex]] = [mixed[swapIndex], mixed[index]];
  }
  return mixed;
}

export function buildAdditionProblem(
  unlockedSkillIds: string[],
  index: number,
  secondsAllowed = FIRST_GAME_SECONDS_PER_PROBLEM,
  rng: Rng = Math.random,
): Problem {
  const available = ADDITION_SKILLS.filter((skill) => unlockedSkillIds.includes(skill.id));
  const skill = available[Math.floor(rng() * available.length)] ?? ADDITION_SKILLS[0];
  const rand = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  let a = rand(0, 5);
  let b = rand(0, 10 - a);
  let c: number | null = null;

  if (skill.id === "addition.doubles") a = b = rand(1, 9);
  if (skill.id === "addition.near-doubles") { a = rand(2, 9); b = Math.max(1, a + (rng() < 0.5 ? -1 : 1)); }
  if (skill.id === "addition.make-ten") { a = rand(1, 9); b = 10 - a; }
  if (skill.id === "addition.eleven-twenty") { a = rand(2, 9); b = rand(Math.max(2, 11 - a), 10); }
  if (skill.id === "addition.three") { a = rand(1, 8); b = rand(1, 8); c = rand(1, Math.max(1, 20 - a - b)); }
  if (skill.id === "addition.ten-multiples") { a = rand(1, 5) * 10; b = rand(1, 5) * 10; }
  if (skill.id === "addition.simple-two-digit") {
    a = rand(1, 8) * 10 + rand(0, 4);
    b = rand(1, 9 - Math.floor(a / 10)) * 10 + rand(0, 9 - (a % 10));
  }
  if (skill.id === "addition.regrouping-ones" || skill.id === "addition.two-digit") {
    a = rand(12, 58);
    b = rand(12, 99 - a);
    if ((a % 10) + (b % 10) < 10) b = Math.min(99 - a, b + (10 - ((a % 10) + (b % 10))));
  }

  return {
    id: `${skill.id}-${index}-${a}+${b}${c === null ? "" : `+${c}`}`,
    operation: "addition",
    skillId: skill.id,
    operandA: a,
    operandB: b,
    operandC: c,
    answer: a + b + (c ?? 0),
    levelId: skill.id,
    threat: "scout",
    secondsAllowed,
  };
}

export function buildSubtractionProblem(
  unlockedSkillIds: string[],
  index: number,
  secondsAllowed = FIRST_GAME_SECONDS_PER_PROBLEM,
  rng: Rng = Math.random,
): Problem {
  const available = SUBTRACTION_SKILLS.filter((skill) => unlockedSkillIds.includes(skill.id));
  const skill = available[Math.floor(rng() * available.length)] ?? SUBTRACTION_SKILLS[0];
  const rand = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  let a = rand(1, 10);
  let b = rand(0, a);

  if (skill.id === "subtraction.zero") { a = rand(1, 10); b = 0; }
  if (skill.id === "subtraction.from-ten") { a = 10; b = rand(1, 9); }
  if (skill.id === "subtraction.fact-families") { a = rand(3, 10); b = rand(1, a - 1); }
  if (skill.id === "subtraction.within-twenty") { a = rand(11, 20); b = rand(1, Math.min(10, a)); }
  if (skill.id === "subtraction.ten-multiples") { a = rand(2, 10) * 10; b = rand(1, Math.floor(a / 10) - 1) * 10; }
  if (skill.id === "subtraction.simple-two-digit") {
    const tensA = rand(2, 9); const tensB = rand(1, tensA - 1); const ones = rand(0, 9);
    a = tensA * 10 + ones; b = tensB * 10 + rand(0, ones);
  }
  if (skill.id === "subtraction.regrouping-ones" || skill.id === "subtraction.two-digit" || skill.id === "subtraction.mixed") {
    a = rand(22, 99); b = rand(11, a - 1);
    if (a % 10 >= b % 10) b = Math.min(a - 1, b + Math.min(9, (a % 10) - (b % 10) + 1));
  }
  return {
    id: `${skill.id}-${index}-${a}-${b}`,
    operation: "subtraction", skillId: skill.id, operandA: a, operandB: b, operandC: null,
    answer: a - b, levelId: skill.id, threat: "scout", secondsAllowed,
  };
}

export function buildDivisionProblem(
  unlockedNumbers: number[],
  index: number,
  secondsAllowed = FIRST_GAME_SECONDS_PER_PROBLEM,
  rng: Rng = Math.random,
): Problem {
  const available = unlockedNumbers.filter((number) => DIVISION_NUMBERS.includes(number));
  const rand = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const divisor = available[Math.floor(rng() * available.length)] ?? 1;
  // Zero is practiced only as the dividend (0 ÷ n = 0). It has no visible
  // division card; the selected non-zero divisor owns the problem and reward.
  const isZeroDividend = rng() < 0.15;
  const quotient = isZeroDividend ? 0 : rand(1, 12);
  const dividend = divisor * quotient;
  return {
    id: `division.row.${divisor}-${index}-${dividend}÷${divisor}`,
    operation: "division", skillId: divisionSkillId(divisor), operandA: dividend, operandB: divisor, operandC: null,
    answer: quotient, levelId: divisionSkillId(divisor), threat: "scout", secondsAllowed,
  };
}

/** Number of enemies in a first-game wave. Shown on the intro screen. */
export const WAVE_SIZE = 5;

// ----------------------------------------------------------------------------
// Dynamic difficulty ramp (anti-speedrun) — accuracy + speed milestones
//
// Each student sits on a milestone (a tier) chosen from their last RAMP_WINDOW
// answers. A milestone requires BOTH a minimum accuracy and a minimum number of
// "fast" answers — correct and answered in under half the time they were given.
// The student's clock is the base time multiplied by their milestone's factor,
// so being fast AND accurate progressively tightens the timer, while a slow run
// or a few misses drops them back to a gentler tier automatically.
//
// Misses are forgiven one at a time. A lone miss in the window is ignored — the
// clock does not move — because one fumbled fact says less about a student than
// the ramp reacting to it would suggest. A second miss lands and both count.
//
// The ladder is calibrated to the design anchor: 5 of the last 8 answers fast
// (with sustained accuracy) lands the student on "Blazing" → 50% of base time.
// See unit-1-mini-clash-multiplication.md > Difficulty Ramp.
// ----------------------------------------------------------------------------

/** Rolling window of recent answers the milestones react to. */
export const RAMP_WINDOW = 8;
/** "Fast" = the answer used less than this fraction of its allotted clock. */
export const RAMP_FAST_THRESHOLD = 0.5;
/** Absolute floor (seconds) on the clock shown to the student. */
export const RAMP_MIN_SECONDS = 1.5;
/**
 * Misses forgiven before the clock eases. One slip is noise — a student who
 * fumbles a single fact shouldn't feel the timer loosen underneath them. It
 * takes a SECOND miss in the window for the tier to move.
 */
export const RAMP_MISS_FORGIVENESS = 1;
/**
 * Answers to keep on hand. The window itself is RAMP_WINDOW; the extra samples
 * are the replacements pulled in when a miss is forgiven, so a forgiven miss
 * leaves the window looking exactly as if it never happened.
 */
export const RAMP_BUFFER = RAMP_WINDOW + RAMP_MISS_FORGIVENESS;

export type AnswerSample = {
  correct: boolean;
  /** Wall-clock seconds the student actually used on the problem. */
  timeTakenSeconds: number;
  /** The clock the student was given for that problem. */
  secondsAllowed: number;
};

export type SpeedMilestone = {
  id: string;
  label: string;
  /** Minimum accuracy over the window to hold this tier. */
  minAccuracy: number;
  /** Minimum "fast" answers in the window (out of RAMP_WINDOW) to hold this tier. */
  minFastAnswers: number;
  /** Fraction of base time the student gets at this tier. */
  timeMultiplier: number;
};

/**
 * Ordered easiest → hardest. A student is placed on the HIGHEST tier whose
 * accuracy and fast-answer thresholds are both met, so speed alone never tightens
 * the clock without accuracy to back it up. Thresholds are monotonic, so dropping
 * accuracy or slowing down demotes the student to a more forgiving tier.
 */
export const SPEED_MILESTONES: SpeedMilestone[] = [
  { id: "warmup", label: "Warmup", minAccuracy: 0, minFastAnswers: 0, timeMultiplier: 1.0 },
  { id: "steady", label: "Steady", minAccuracy: 0.75, minFastAnswers: 2, timeMultiplier: 0.85 },
  { id: "sharp", label: "Sharp", minAccuracy: 0.8, minFastAnswers: 3, timeMultiplier: 0.7 },
  { id: "blazing", label: "Blazing", minAccuracy: 0.85, minFastAnswers: 5, timeMultiplier: 0.5 }, // anchor
  { id: "untouchable", label: "Untouchable", minAccuracy: 0.9, minFastAnswers: 7, timeMultiplier: 0.35 },
];

/** A "fast" answer is correct and used under RAMP_FAST_THRESHOLD of its clock. */
export function isFastAnswer(sample: AnswerSample): boolean {
  if (!sample.correct || sample.secondsAllowed <= 0) return false;
  return sample.timeTakenSeconds < sample.secondsAllowed * RAMP_FAST_THRESHOLD;
}

/** Accuracy over the window; an empty window reads as fully accurate (warmup). */
export function windowAccuracy(window: AnswerSample[]): number {
  if (window.length === 0) return 1;
  return window.filter((sample) => sample.correct).length / window.length;
}

/**
 * The RAMP_WINDOW answers the tier is actually judged on.
 *
 * While the buffer holds no more than RAMP_MISS_FORGIVENESS misses, those misses
 * are dropped and older answers slide in to replace them — a single slip leaves
 * the tier exactly where it was. The moment a second miss lands, forgiveness
 * lapses and BOTH misses count, so the clock eases on the second miss, not the
 * first. Recovering to one miss in the buffer restores the forgiveness.
 */
export function rampWindow(recent: AnswerSample[]): AnswerSample[] {
  const buffered = recent.slice(-RAMP_BUFFER);
  const missCount = buffered.filter((sample) => !sample.correct).length;
  const judged = missCount > RAMP_MISS_FORGIVENESS ? buffered : buffered.filter((sample) => sample.correct);
  return judged.slice(-RAMP_WINDOW);
}

/** The milestone a student currently sits on, from their recent answers. */
export function currentMilestone(recent: AnswerSample[]): SpeedMilestone {
  const window = rampWindow(recent);
  const accuracy = windowAccuracy(window);
  const fastCount = window.filter(isFastAnswer).length;

  let reached = SPEED_MILESTONES[0];
  for (const milestone of SPEED_MILESTONES) {
    if (accuracy >= milestone.minAccuracy && fastCount >= milestone.minFastAnswers) {
      reached = milestone;
    }
  }
  return reached;
}

/**
 * Advance the ramp one problem, from the tier the student is currently holding.
 *
 * Demotions step DOWN ONE TIER AT A TIME. The raw window can call for a big
 * drop — two misses out of eight reads as 0.75 accuracy, which on its own
 * plunges an Untouchable student straight to Steady — and that lurch is worse
 * for a kid than the difficulty it corrects. Stepping means the clock loosens
 * noticeably but not alarmingly, and keeps loosening each problem while the
 * student is still struggling, so it still arrives where the window says it
 * should within a few answers.
 *
 * Promotions are uncapped: earning a tighter clock already takes a sustained
 * run of fast, accurate answers, so there is nothing to smooth out.
 */
export function steppedMilestone(recent: AnswerSample[], heldId?: string | null): SpeedMilestone {
  const target = currentMilestone(recent);
  if (heldId === undefined || heldId === null) return target;

  const heldIndex = milestoneIndex(heldId);
  const targetIndex = milestoneIndex(target.id);
  if (targetIndex >= heldIndex) return target;
  return SPEED_MILESTONES[Math.max(0, heldIndex - 1)];
}

/** Time-compression multiplier for the student's current milestone. */
export function rampMultiplier(recent: AnswerSample[]): number {
  return currentMilestone(recent).timeMultiplier;
}

/** Apply a resolved milestone to a base clock, respecting the absolute seconds floor. */
export function milestoneSeconds(baseSeconds: number, milestone: SpeedMilestone): number {
  const scaled = baseSeconds * milestone.timeMultiplier;
  return Math.max(RAMP_MIN_SECONDS, Math.round(scaled * 10) / 10);
}

/** Apply the milestone ramp to a base clock, respecting the absolute seconds floor. */
export function rampedSeconds(baseSeconds: number, recent: AnswerSample[], milestone?: SpeedMilestone): number {
  return milestoneSeconds(baseSeconds, milestone ?? currentMilestone(recent));
}

/**
 * Seconds between boss pulses. Uses the same milestone multiplier as the problem
 * timer so Warmup kids get long gaps and Untouchable kids get pressed hard.
 */
export function bossPulseSeconds(recent: AnswerSample[], milestone?: SpeedMilestone): number {
  const scaled = BOSS_PULSE_BASE_SECONDS * (milestone ?? currentMilestone(recent)).timeMultiplier;
  return Math.max(BOSS_PULSE_MIN_SECONDS, Math.round(scaled * 10) / 10);
}

// ----------------------------------------------------------------------------
// Carried-over speed profile (cross-battle)
//
// The ramp above reacts within a single battle. On its own it resets every match,
// so a student who ended one battle on "Blazing" starts the next one back at
// "Warmup" and has to re-earn the tight clock from scratch.
//
// A speed profile fixes that. At the end of a battle we record where the student
// ended up (per arena — being fast at addition says little about division), then
// SOFTEN that by one milestone. The next battle in that arena starts on the
// softened tier instead of Warmup: still a warmup beat, but the clock already
// reflects how fast this student actually is, and a few fast answers put them
// right back at their ceiling.
// ----------------------------------------------------------------------------

/** How many tiers to drop between battles, so every match still opens with a beat of slack. */
export const SPEED_CARRYOVER_SOFTEN_TIERS = 1;

export function milestoneById(id: string | null | undefined): SpeedMilestone {
  return SPEED_MILESTONES.find((milestone) => milestone.id === id) ?? SPEED_MILESTONES[0];
}

export function milestoneIndex(id: string | null | undefined): number {
  const index = SPEED_MILESTONES.findIndex((milestone) => milestone.id === id);
  return index < 0 ? 0 : index;
}

/** Step a milestone down the ladder — the between-battle discount on earned speed. */
export function softenMilestone(id: string | null | undefined, tiers = SPEED_CARRYOVER_SOFTEN_TIERS): SpeedMilestone {
  return SPEED_MILESTONES[Math.max(0, milestoneIndex(id) - Math.max(0, tiers))];
}

export type MatchSpeedStats = {
  /** Milestone the student was sitting on when the battle ended. */
  endingMilestoneId: string;
  /** Milestone the NEXT battle in this arena should open on. */
  carryMilestoneId: string;
  /** Time multiplier the next battle opens with. */
  carryMultiplier: number;
  attempts: number;
  correctCount: number;
  accuracy: number;
  fastCount: number;
  /** Share of answers that were correct and under half their clock. */
  fastRate: number;
  medianTimeSeconds: number;
  /** Mean of timeTaken / secondsAllowed — how much of the clock they typically used. */
  averageClockUsed: number;
};

export function medianSeconds(samples: AnswerSample[]): number {
  if (samples.length === 0) return 0;
  const sorted = samples.map((sample) => sample.timeTakenSeconds).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return Math.round(value * 100) / 100;
}

/**
 * Summarize a finished battle into the numbers we persist. `recent` is the
 * trailing ramp window (what the ending milestone is computed from); `all` is
 * every answer in the match (what the history stats describe).
 */
export function summarizeMatchSpeed(
  all: AnswerSample[],
  recent: AnswerSample[] = all.slice(-RAMP_BUFFER),
  // The tier the student was actually playing at. Because demotions step, this
  // can sit above what the raw window alone would say; what we carry forward
  // should be the clock they were really holding.
  heldMilestoneId?: string | null,
): MatchSpeedStats {
  const ending = heldMilestoneId ? milestoneById(heldMilestoneId) : currentMilestone(recent);
  const carry = softenMilestone(ending.id);
  const attempts = all.length;
  const correctCount = all.filter((sample) => sample.correct).length;
  const fastCount = all.filter(isFastAnswer).length;
  const clockUsed = all.filter((sample) => sample.secondsAllowed > 0);
  const averageClockUsed = clockUsed.length
    ? clockUsed.reduce((total, sample) => total + sample.timeTakenSeconds / sample.secondsAllowed, 0) / clockUsed.length
    : 0;

  return {
    endingMilestoneId: ending.id,
    carryMilestoneId: carry.id,
    carryMultiplier: carry.timeMultiplier,
    attempts,
    correctCount,
    accuracy: attempts ? correctCount / attempts : 0,
    fastCount,
    fastRate: attempts ? fastCount / attempts : 0,
    medianTimeSeconds: medianSeconds(all),
    averageClockUsed: Math.round(averageClockUsed * 1000) / 1000,
  };
}

/**
 * Synthetic answer window that places a student on `milestoneId` from the first
 * problem of a battle. The ramp reads a rolling window rather than a stored
 * multiplier, so the cleanest way to start a battle mid-ladder is to seed that
 * window with answers that satisfy the tier. Real answers push these out within
 * RAMP_WINDOW problems, so the seed only shapes the opening.
 */
export function seedSamplesForMilestone(milestoneId: string | null | undefined): AnswerSample[] {
  const target = milestoneById(milestoneId);
  if (target.timeMultiplier >= 1) return [];

  const clock = 10;
  // Exactly minFastAnswers fast samples: enough to hold the target tier, and —
  // because minFastAnswers strictly increases up the ladder — never enough to
  // reach the tier above it.
  return Array.from({ length: RAMP_WINDOW }, (_, index) => {
    const isFast = index < target.minFastAnswers;
    return {
      correct: true,
      // Fast samples sit clearly under the threshold; the rest clearly over it.
      timeTakenSeconds: isFast ? clock * (RAMP_FAST_THRESHOLD / 2) : clock * 0.9,
      secondsAllowed: clock,
    } satisfies AnswerSample;
  });
}

/** Draw a single on-demand problem from the unlocked pool (used by the live wave loop). */
export function drawProblem(
  unlockedNumbers: number[],
  seq: number,
  level = getAvailableLevel(unlockedNumbers),
  rng: () => number = Math.random,
  recentAnswers: AnswerSample[] = [],
  unlockedAdditionSkills: string[] = [STARTER_ADDITION_SKILL_ID],
  unlockedSubtractionSkills: string[] = [STARTER_SUBTRACTION_SKILL_ID],
  unlockedDivisionNumbers: number[] = DIVISION_NUMBERS,
  allowedOperations: Operation[] = ["addition", "subtraction", "division", "multiplication"],
  // Tier to issue this problem at. The caller resolves it (via steppedMilestone)
  // so the one-tier-per-step cap is applied exactly once per problem; without it
  // we fall back to reading the window directly.
  milestone: SpeedMilestone = currentMilestone(recentAnswers),
): Problem {
  const operations = allowedOperations.length ? allowedOperations : ["addition"];
  const operation = operations[Math.floor(rng() * operations.length)] ?? "addition";
  if (operation === "addition") {
    const problem = buildAdditionProblem(unlockedAdditionSkills, seq, level.difficulty.secondsPerProblem, rng);
    return { ...problem, secondsAllowed: milestoneSeconds(problem.secondsAllowed, milestone) };
  }
  if (operation === "subtraction") {
    const problem = buildSubtractionProblem(unlockedSubtractionSkills, seq, level.difficulty.secondsPerProblem, rng);
    return { ...problem, secondsAllowed: milestoneSeconds(problem.secondsAllowed, milestone) };
  }
  if (operation === "division") {
    const problem = buildDivisionProblem(unlockedDivisionNumbers, seq, level.difficulty.secondsPerProblem, rng);
    return { ...problem, secondsAllowed: milestoneSeconds(problem.secondsAllowed, milestone) };
  }
  const pool = selectPracticeNumbers(unlockedNumbers);
  const factorA = pool[Math.floor(rng() * pool.length)] ?? STARTING_UNLOCKED_NUMBERS[0];
  const factorB = pool[Math.floor(rng() * pool.length)] ?? STARTING_UNLOCKED_NUMBERS[0];
  return {
    id: `${level.id}-draw-${seq}-${factorA}x${factorB}`,
    operation: "multiplication",
    skillId: multiplicationSkillId(factorA),
    operandA: factorA,
    operandB: factorB,
    operandC: null,
    answer: factorA * factorB,
    levelId: level.id,
    threat: "scout",
    secondsAllowed: milestoneSeconds(level.difficulty.secondsPerProblem, milestone),
  };
}

export function evaluatePass(criteria: PassCriteria, correct: number, incorrect: number, damageTaken: number) {
  const attempts = correct + incorrect;
  const accuracy = attempts === 0 ? 0 : correct / attempts;
  return correct >= criteria.minCorrect && accuracy >= criteria.minAccuracy && damageTaken <= criteria.maxDamageTaken;
}

export function getNextUnlockPreview(unlockedNumbers: number[]) {
  const unlocked = new Set(unlockedNumbers);

  for (const rarity of Object.keys(chestNumberPools) as Rarity[]) {
    const nextNumber = chestNumberPools[rarity].find((number) => !unlocked.has(number));
    if (nextNumber !== undefined) return { rarity, number: nextNumber };
  }

  return null;
}
