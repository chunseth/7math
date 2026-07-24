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
  incorrectDamage: number;
  timeoutDamage: number;
  bossDamage: number;
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

export type Problem = {
  id: string;
  factorA: number;
  factorB: number;
  answer: number;
  levelId: string;
  threat: "scout" | "shield" | "fast" | "boss";
  secondsAllowed: number;
};

export const STARTING_UNLOCKED_NUMBERS = [6, 7, 8, 9];
export const FIRST_GAME_QUESTION_COUNT = 6;
export const FIRST_GAME_SECONDS_PER_PROBLEM = 5;
export const FIRST_GAME_PROBLEM_POOL: Problem[] = [
  { id: "first-game-6x7", factorA: 6, factorB: 7, answer: 42, levelId: "unit-1.first-game", threat: "scout", secondsAllowed: FIRST_GAME_SECONDS_PER_PROBLEM },
  { id: "first-game-7x6", factorA: 7, factorB: 6, answer: 42, levelId: "unit-1.first-game", threat: "scout", secondsAllowed: FIRST_GAME_SECONDS_PER_PROBLEM },
  { id: "first-game-8x9", factorA: 8, factorB: 9, answer: 72, levelId: "unit-1.first-game", threat: "scout", secondsAllowed: FIRST_GAME_SECONDS_PER_PROBLEM },
  { id: "first-game-9x8", factorA: 9, factorB: 8, answer: 72, levelId: "unit-1.first-game", threat: "scout", secondsAllowed: FIRST_GAME_SECONDS_PER_PROBLEM },
  { id: "first-game-6x8", factorA: 6, factorB: 8, answer: 48, levelId: "unit-1.first-game", threat: "scout", secondsAllowed: FIRST_GAME_SECONDS_PER_PROBLEM },
  { id: "first-game-8x6", factorA: 8, factorB: 6, answer: 48, levelId: "unit-1.first-game", threat: "scout", secondsAllowed: FIRST_GAME_SECONDS_PER_PROBLEM },
  { id: "first-game-6x9", factorA: 6, factorB: 9, answer: 54, levelId: "unit-1.first-game", threat: "scout", secondsAllowed: FIRST_GAME_SECONDS_PER_PROBLEM },
  { id: "first-game-9x6", factorA: 9, factorB: 6, answer: 54, levelId: "unit-1.first-game", threat: "scout", secondsAllowed: FIRST_GAME_SECONDS_PER_PROBLEM },
  { id: "first-game-7x8", factorA: 7, factorB: 8, answer: 56, levelId: "unit-1.first-game", threat: "scout", secondsAllowed: FIRST_GAME_SECONDS_PER_PROBLEM },
  { id: "first-game-8x7", factorA: 8, factorB: 7, answer: 56, levelId: "unit-1.first-game", threat: "scout", secondsAllowed: FIRST_GAME_SECONDS_PER_PROBLEM },
];
export const COMPLETE_MULTIPLICATION_MAP = Array.from({ length: 13 }, (_, number) => number);

export const chestRarityWeights: Record<Rarity, number> = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 3,
};

export const chestNumberPools: Record<Rarity, number[]> = {
  common: [3, 4, 5],
  rare: [11, 12],
  epic: [10, 2],
  legendary: [0, 1],
};

export const multiplicationLevels: MultiplicationLevel[] = [
  {
    id: "unit-1.tables-6-9",
    title: "First Arena",
    mapNumbers: [6, 7, 8, 9],
    focus: "Mixed 6, 7, 8, and 9 facts",
    rarity: "common",
    passCriteria: { minCorrect: 8, minAccuracy: 0.7, maxDamageTaken: 40, chestRequiresCorrect: 1 },
    difficulty: { waveSize: 12, secondsPerProblem: 5, incorrectDamage: 10, timeoutDamage: 10, bossDamage: 20, shieldHits: 1 },
  },
  {
    id: "unit-1.common-expansion",
    title: "Anchor Rows",
    mapNumbers: [3, 4, 5, 6, 7, 8, 9],
    focus: "Adds familiar rows that support factors and skip-counting",
    rarity: "common",
    passCriteria: { minCorrect: 10, minAccuracy: 0.75, maxDamageTaken: 35, chestRequiresCorrect: 1 },
    difficulty: { waveSize: 14, secondsPerProblem: 5, incorrectDamage: 10, timeoutDamage: 10, bossDamage: 20, shieldHits: 1 },
  },
  {
    id: "unit-1.upper-facts",
    title: "Upper Facts",
    mapNumbers: [3, 4, 5, 6, 7, 8, 9, 11, 12],
    focus: "Adds 11s and 12s for stronger fluency",
    rarity: "rare",
    passCriteria: { minCorrect: 12, minAccuracy: 0.8, maxDamageTaken: 30, chestRequiresCorrect: 1 },
    difficulty: { waveSize: 16, secondsPerProblem: 4.5, incorrectDamage: 12, timeoutDamage: 12, bossDamage: 24, shieldHits: 2 },
  },
  {
    id: "unit-1.full-map",
    title: "Full Map Clash",
    mapNumbers: COMPLETE_MULTIPLICATION_MAP,
    focus: "Mixed 0-12 multiplication mastery",
    rarity: "legendary",
    passCriteria: { minCorrect: 16, minAccuracy: 0.85, maxDamageTaken: 25, chestRequiresCorrect: 1 },
    difficulty: { waveSize: 20, secondsPerProblem: 4, incorrectDamage: 15, timeoutDamage: 15, bossDamage: 30, shieldHits: 2 },
  },
];

export function getAvailableLevel(unlockedNumbers: number[]) {
  const unlocked = new Set(unlockedNumbers);
  return (
    [...multiplicationLevels]
      .reverse()
      .find((level) => level.mapNumbers.every((number) => unlocked.has(number))) ?? multiplicationLevels[0]
  );
}

export function selectPracticeNumbers(unlockedNumbers: number[], level = getAvailableLevel(unlockedNumbers)) {
  const available = new Set([...STARTING_UNLOCKED_NUMBERS, ...unlockedNumbers]);
  return level.mapNumbers.filter((number) => available.has(number));
}

export function buildWave(unlockedNumbers: number[], level = getAvailableLevel(unlockedNumbers)): Problem[] {
  const pool = selectPracticeNumbers(unlockedNumbers, level);

  return Array.from({ length: level.difficulty.waveSize }, (_, index) => {
    const factorA = pool[index % pool.length];
    const factorB = pool[(index * 3 + 1) % pool.length];
    const isBoss = index === level.difficulty.waveSize - 1;
    const isShield = !isBoss && level.difficulty.shieldHits > 1 && index % 5 === 3;
    const isFast = !isBoss && index % 4 === 2;

    return {
      id: `${level.id}-${index}`,
      factorA,
      factorB,
      answer: factorA * factorB,
      levelId: level.id,
      threat: isBoss ? "boss" : isShield ? "shield" : isFast ? "fast" : "scout",
      secondsAllowed: isFast ? Math.max(3, level.difficulty.secondsPerProblem - 1) : level.difficulty.secondsPerProblem,
    };
  });
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
