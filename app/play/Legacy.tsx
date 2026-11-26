"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NumberPad from "../components/NumberPad";
import {
  ADDITION_SKILLS,
  DIVISION_NUMBERS,
  SKILLS_BY_OPERATION,
  STARTING_UNLOCKED_NUMBERS,
  STARTER_ADDITION_SKILL_ID,
  STARTER_SUBTRACTION_SKILL_ID,
  SUBTRACTION_SKILLS,
  bossPulseSeconds,
  clampCardCount,
  drawProblem,
  enemyHpForArena,
  getProfileLevelFromXp,
  MONSTER_HP,
  PLAYER_MAX_HEALTH,
  RAMP_BUFFER,
  resolveBossHit,
  resolveMiss,
  rollProblemDamage,
  rollNumberUnlock,
  multiplicationSkillId,
  milestoneById,
  operationArenaById,
  operationForSkillId,
  seedSamplesForMilestone,
  steppedMilestone,
  summarizeMatchSpeed,
  worldArenaIds,
  type AnswerSample,
  type Operation,
  type OperationArena,
  type Problem,
  type Rarity,
} from "../../lib/gameplay";
import { supabase } from "../../lib/supabase";
import { getActiveProfileId } from "../../lib/legacy-profile";

type Feedback = "idle" | "correct" | "timeout";
type Phase = "intro" | "combat" | "victory" | "defeat";
type Attempt = {
  operation: Operation;
  skillId: string;
  operandA: number;
  operandB: number;
  operandC: number | null;
  expectedAnswer: number;
  studentAnswer: number | null;
  isCorrect: boolean;
  xpEarned: number;
  timeMs: number;
};

type ChestStatus = "pending" | "earned" | "full" | "missed" | "error";

type LevelUpChestReward = {
  reward_type: "coins" | "cards" | "unlock";
  operation: Operation | null;
  skill_id: string | null;
  coin_amount: number | null;
  card_amount: number | null;
};

type LevelUpChestOffer = {
  toLevel: number;
  rewards: LevelUpChestReward[];
  opened: boolean;
  claimed: string[];
};

type MatchSummary = {
  survived: boolean;
  correctCount: number;
  incorrectCount: number;
  xpEarned: number;
  coinsEarned: number;
  enemiesDefeated: number;
  cards: Record<string, number>;
  chestStatus: ChestStatus;
  levelsGained: number;
  chestsAwarded: number;
  levelUpChests: LevelUpChestOffer[];
};

const summaryChestMessage: Record<ChestStatus, string> = {
  pending: "Saving your rewards…",
  earned: "Chest earned — check your slots at home",
  full: "Chest slots full — open one to earn more",
  missed: "No chest this time",
  error: "Saved with an error — try again later",
};

function summaryRewardMessage(summary: MatchSummary | null): string {
  if (!summary) return summaryChestMessage.pending;
  if (summary.chestStatus === "pending" || summary.chestStatus === "error") {
    return summaryChestMessage[summary.chestStatus];
  }

  const { levelsGained, chestStatus, levelUpChests } = summary;
  const pendingLevelChests = levelUpChests.filter((chest) => !chest.opened).length;
  if (pendingLevelChests > 0) {
    const levelText = levelsGained === 1 ? "Level up!" : `Leveled up ×${levelsGained}!`;
    return `${levelText} Open your reward chest${pendingLevelChests > 1 ? "s" : ""}`;
  }
  if (levelsGained > 0) {
    const levelText = levelsGained === 1 ? "Level up!" : `Leveled up ×${levelsGained}!`;
    return `${levelText} Reward chest claimed`;
  }
  return summaryChestMessage[chestStatus];
}

function rewardLabel(reward: LevelUpChestReward) {
  if (reward.reward_type === "coins") return `+${reward.coin_amount ?? 0} coins`;
  if (reward.reward_type === "unlock" && reward.skill_id) return `Unlocked ${skillTitle(reward.skill_id)}`;
  if (reward.reward_type === "cards" && reward.skill_id) {
    return `+${reward.card_amount ?? 0} ${skillTitle(reward.skill_id)} cards`;
  }
  return "Reward";
}

function skillTitle(skillId: string) {
  const skill = [...ADDITION_SKILLS, ...SUBTRACTION_SKILLS].find((entry) => entry.id === skillId);
  if (skill) return skill.title;
  const divisionRow = skillId.match(/^division\.row\.(\d+)$/)?.[1];
  if (divisionRow) return `Divide by ${divisionRow}`;
  const row = skillId.match(/^multiplication\.row\.(\d+)$/)?.[1];
  return row ? `${row}s` : skillId;
}

const spriteNames = [
  "raijin", "phoenix", "pooka", "long", "banshee", "skinwalker", "nian", "jormungandr", "simurgh", "naga",
  "hydra", "garuda", "pegasus", "anubis", "valkyrie", "oni", "horus", "griffin", "chupacabra", "fenrir",
  "minotaur", "kitsune", "seraph", "sphynx", "quetzalcoatl",
];


// Seconds the "unskippable" teaching video runs before Retry unlocks.
const TEACHING_AD_SECONDS = 5;

function randomSprite() {
  return spriteNames[Math.floor(Math.random() * spriteNames.length)];
}

// A wave of enemy sprites. Avoids repeating the same sprite back to back.
function buildWaveRoster(size: number) {
  const roster: string[] = [];
  for (let i = 0; i < size; i += 1) {
    let sprite = randomSprite();
    let guard = 0;
    while (sprite === roster[i - 1] && guard < 6) {
      sprite = randomSprite();
      guard += 1;
    }
    roster.push(sprite);
  }
  return roster;
}

function formatAttemptEquation(attempt: Attempt) {
  const symbol = attempt.operation === "addition" ? " + " : attempt.operation === "subtraction" ? " − " : attempt.operation === "division" ? " ÷ " : " × ";
  return `${attempt.operandA}${symbol}${attempt.operandB}${attempt.operandC === null ? "" : ` + ${attempt.operandC}`} = ${attempt.expectedAnswer}`;
}

function teachingHint(attempt: Attempt) {
  if (attempt.operation === "multiplication") return `Count by ${attempt.operandA}, ${attempt.operandB} times:`;
  if (attempt.operation === "division") return `How many groups of ${attempt.operandB} make ${attempt.operandA}?`;
  if (attempt.operation === "subtraction") return "Start with the first number and count back:";
  if (attempt.skillId === "addition.make-ten") return "Find the pair that makes ten:";
  if (attempt.skillId.includes("regroup")) return "Combine the ones first, then regroup ten ones:";
  return "Start with the larger number and count on:";
}

function teachingSteps(attempt: Attempt) {
  if (attempt.operation === "multiplication") {
    return Array.from({ length: Math.min(attempt.operandB, 12) }, (_, i) => attempt.operandA * (i + 1));
  }
  if (attempt.operation === "division") {
    return Array.from({ length: Math.min(attempt.expectedAnswer, 12) }, (_, i) => attempt.operandB * (i + 1));
  }
  return [attempt.operandA, attempt.operandA + attempt.operandB, attempt.expectedAnswer];
}

// Turn a card's skillId into a summary chip: a gem token, a full label, and a
// sort key (multiplication total first, then other skills in unlock order).
function summaryCardMeta(skillId: string): { gem: string; title: string; sort: number } {
  const operation = operationForSkillId(skillId);
  const skills = operation === "addition" || operation === "subtraction" ? SKILLS_BY_OPERATION[operation] : [];
  const index = skills.findIndex((skill) => skill.id === skillId);
  const symbol = operation === "addition" ? "+" : operation === "subtraction" ? "−" : "÷";
  return { gem: symbol, title: index >= 0 ? skills[index].title : skillId, sort: 100 + (operation === "addition" ? 0 : operation === "subtraction" ? 20 : 40) + (index < 0 ? 19 : index) };
}

export default function PlayPage() {
  const router = useRouter();
  const roundStartedAtRef = useRef<number>(Date.now());
  const problemStartedAtRef = useRef<number>(Date.now());
  const isCompletingRef = useRef(false);
  const attemptsRef = useRef<Attempt[]>([]);
  // Rolling window of recent answer speeds; drives the anti-speedrun time ramp.
  // Seeded at match start from the arena's saved speed profile so the clock
  // opens where the student left off rather than back at Warmup.
  const recentAnswersRef = useRef<AnswerSample[]>([]);
  // Every answer this match, kept whole for the persisted speed summary.
  const allAnswersRef = useRef<AnswerSample[]>([]);
  // Milestone this battle opened on, recorded in the speed history.
  const startingMilestoneRef = useRef<string>("warmup");
  // Tier the student is currently playing at. Demotions step down from here one
  // tier per problem, so this can sit above what the raw window alone would say.
  const heldMilestoneRef = useRef<string>("warmup");
  // Cards earned per number this match (granted on correct answers only).
  const cardTallyRef = useRef<Record<string, number>>({});
  const levelBySkillRef = useRef<Record<string, number>>({});
  // Player's unlocked numbers, used to draw problems on demand.
  const unlockedRef = useRef<number[]>(STARTING_UNLOCKED_NUMBERS);
  const unlockedAdditionRef = useRef<string[]>([STARTER_ADDITION_SKILL_ID]);
  const unlockedSubtractionRef = useRef<string[]>([STARTER_SUBTRACTION_SKILL_ID]);
  const unlockedDivisionRef = useRef<number[]>(DIVISION_NUMBERS);
  const arenaRef = useRef<OperationArena>(operationArenaById("addition"));
  // Combat truth values kept in refs to avoid stale closures inside timeouts.
  const monsterHpRef = useRef<number>(MONSTER_HP);
  const monsterMaxHpRef = useRef<number>(MONSTER_HP);
  const playerHealthRef = useRef<number>(PLAYER_MAX_HEALTH);
  const problemSeqRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>("intro");
  const [wave, setWave] = useState<string[] | null>(null);
  const [introStep, setIntroStep] = useState(0);
  const [enemyIndex, setEnemyIndex] = useState(0);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [answer, setAnswer] = useState("");
  const [timerRun, setTimerRun] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [playerHealth, setPlayerHealth] = useState(PLAYER_MAX_HEALTH);
  const [monsterHp, setMonsterHp] = useState(MONSTER_HP);
  const [lastDamage, setLastDamage] = useState<{ amount: number; crit: boolean; kind: "deal" | "take"; key: number } | null>(null);
  const [playerSprite, setPlayerSprite] = useState("raijin");
  const [adCountdown, setAdCountdown] = useState(TEACHING_AD_SECONDS);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [levelUpChestIndex, setLevelUpChestIndex] = useState(0);
  const [openingLevelUpChest, setOpeningLevelUpChest] = useState(false);
  const [arena, setArena] = useState<OperationArena>(operationArenaById("addition"));
  // Speed tier this battle opens on, carried from the student's last run here.
  const [startingMilestoneLabel, setStartingMilestoneLabel] = useState("Warmup");
  // After a boss loss, world map progress is wiped so the student must redo the world.
  const [worldProgressReset, setWorldProgressReset] = useState(false);

  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const waveLength = wave?.length ?? arena.enemyCount;
  const challengerSprite = wave && wave.length ? wave[Math.min(enemyIndex, wave.length - 1)] : "raijin";
  const isInputLocked = !currentProblem || feedback !== "idle" || phase !== "combat";

  useEffect(() => {
    if (!getActiveProfileId()) {
      router.replace("/7math");
    }
  }, [router]);

  useEffect(() => {
    const profileId = getActiveProfileId();
    if (!profileId) return;
    const activeProfileId = profileId;

    let cancelled = false;

    async function loadMatch() {
      const requestedArena = operationArenaById(new URLSearchParams(window.location.search).get("arena"));
      let unlockedNumbers = STARTING_UNLOCKED_NUMBERS;
      let unlockedAdditionSkills = [STARTER_ADDITION_SKILL_ID];
      let unlockedSubtractionSkills = [STARTER_SUBTRACTION_SKILL_ID];
      let unlockedDivisionNumbers = DIVISION_NUMBERS;
      let carriedMilestoneId = "warmup";

      if (supabase) {
        const [{ data: profile }, { data: progress }, { data: cards }, { data: speedProfile }] = await Promise.all([
          supabase.from("profiles").select("sprite_name").eq("id", activeProfileId).maybeSingle(),
          supabase.from("student_progress").select("unlocked_numbers").eq("profile_id", activeProfileId).maybeSingle(),
          supabase.from("skill_cards").select("skill_id, operation, level").eq("profile_id", activeProfileId),
          supabase
            .from("arena_speed_profiles")
            .select("carry_milestone_id")
            .eq("profile_id", activeProfileId)
            .eq("arena_id", requestedArena.id)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        // How fast this student was last time in THIS arena, already softened
        // one tier when it was saved.
        if (speedProfile?.carry_milestone_id) {
          carriedMilestoneId = speedProfile.carry_milestone_id;
        }

        if (profile?.sprite_name && spriteNames.includes(profile.sprite_name)) {
          setPlayerSprite(profile.sprite_name);
        }

        if (progress?.unlocked_numbers?.length) {
          unlockedNumbers = progress.unlocked_numbers;
        }

        const levels: Record<string, number> = {};
        for (const row of cards ?? []) levels[row.skill_id] = row.level;
        levelBySkillRef.current = levels;
        const additions = (cards ?? []).filter((row) => row.operation === "addition").map((row) => row.skill_id);
        const subtractions = (cards ?? []).filter((row) => row.operation === "subtraction").map((row) => row.skill_id);
        const divisions = (cards ?? [])
          .filter((row) => row.operation === "division")
          .map((row) => Number(row.skill_id.match(/^division\.row\.(\d+)$/)?.[1]))
          .filter((number) => DIVISION_NUMBERS.includes(number));
        if (additions.length) unlockedAdditionSkills = additions;
        if (subtractions.length) unlockedSubtractionSkills = subtractions;
        if (divisions.length) unlockedDivisionNumbers = divisions;
      }

      if (cancelled) return;

      unlockedRef.current = unlockedNumbers;
      unlockedAdditionRef.current = unlockedAdditionSkills;
      unlockedSubtractionRef.current = unlockedSubtractionSkills;
      unlockedDivisionRef.current = unlockedDivisionNumbers;
      arenaRef.current = requestedArena;
      setArena(requestedArena);
      const firstEnemyHp = enemyHpForArena(requestedArena, 0);
      monsterHpRef.current = firstEnemyHp;
      monsterMaxHpRef.current = firstEnemyHp;
      setMonsterHp(firstEnemyHp);
      problemSeqRef.current = 0;
      // Seed the ramp window so the very first problem already reflects the
      // carried-over tier. Real answers displace the seed within RAMP_WINDOW.
      startingMilestoneRef.current = carriedMilestoneId;
      heldMilestoneRef.current = carriedMilestoneId;
      recentAnswersRef.current = seedSamplesForMilestone(carriedMilestoneId);
      allAnswersRef.current = [];
      setStartingMilestoneLabel(milestoneById(carriedMilestoneId).label);
      setCurrentProblem(
        drawProblem(
          unlockedNumbers,
          0,
          undefined,
          undefined,
          recentAnswersRef.current,
          unlockedAdditionSkills,
          unlockedSubtractionSkills,
          unlockedDivisionNumbers,
          requestedArena.operations,
          milestoneById(carriedMilestoneId),
        ),
      );
      setWave(buildWaveRoster(requestedArena.enemyCount));
    }

    void loadMatch();

    return () => {
      cancelled = true;
    };
  }, []);

  // Intro sequence: flash each enemy in the wave, then a FIGHT beat, then combat.
  useEffect(() => {
    if (phase !== "intro" || !wave) return;
    const isFightBeat = introStep >= wave.length;
    const id = window.setTimeout(
      () => {
        if (isFightBeat) startCombat();
        else setIntroStep((step) => step + 1);
      },
      isFightBeat ? 750 : 360,
    );
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, wave, introStep]);

  useEffect(() => {
    if (!currentProblem) return;
    problemStartedAtRef.current = Date.now();
  }, [currentProblem?.id, timerRun]);

  // Teaching-ad countdown on defeat.
  useEffect(() => {
    if (phase !== "defeat" || adCountdown <= 0) return;
    const id = window.setTimeout(() => setAdCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [phase, adCountdown]);

  // Boss arena pulse: hits on a skill-scaled cadence (Warmup ≈ 10s … Untouchable ≈ 3.5s).
  // Does not lock input or reset the problem timer — this is a DPS-race chip, not a miss.
  // Defers a beat if a miss/correct animation is already playing so hits don't stack.
  useEffect(() => {
    if (phase !== "combat" || arena.missionType !== "boss") return;

    let cancelled = false;
    let timeoutId = 0;

    const schedule = (ms?: number) => {
      // Pulse on the tier the student is actually holding, so the boss eases
      // off in step with the problem clock rather than ahead of it.
      const delay = ms ?? bossPulseSeconds(recentAnswersRef.current, milestoneById(heldMilestoneRef.current)) * 1000;
      timeoutId = window.setTimeout(tick, delay);
    };

    const tick = () => {
      if (cancelled || phaseRef.current !== "combat" || isCompletingRef.current) return;
      if (feedbackRef.current !== "idle") {
        schedule(200);
        return;
      }

      const result = resolveBossHit(playerHealthRef.current);
      playerHealthRef.current = result.remainingHealth;
      setPlayerHealth(result.remainingHealth);
      setLastDamage({ amount: result.damage, crit: result.isCrit, kind: "take", key: Date.now() });

      if (result.remainingHealth <= 0) {
        setFeedback("timeout");
        window.setTimeout(() => finishMatch(false), 520);
        return;
      }

      schedule();
    };

    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, arena.missionType]);

  useEffect(() => {
    function handlePhysicalKey(event: KeyboardEvent) {
      if (isInputLocked || !currentProblem) return;

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        enterDigit(event.key);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        setAnswer((value) => value.slice(0, -1));
      }
    }

    window.addEventListener("keydown", handlePhysicalKey);
    return () => window.removeEventListener("keydown", handlePhysicalKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, currentProblem, isInputLocked]);

  function startCombat() {
    if (!wave) return;
    roundStartedAtRef.current = Date.now();
    problemStartedAtRef.current = Date.now();
    setTimerRun((run) => run + 1);
    setPhase("combat");
  }

  function levelOf(skillId: string) {
    return levelBySkillRef.current[skillId] ?? 1;
  }

  function nextProblem() {
    problemSeqRef.current += 1;
    // Resolve the tier once per problem: the window may call for a big drop,
    // but the student only ever moves one tier down at a time.
    const milestone = steppedMilestone(recentAnswersRef.current, heldMilestoneRef.current);
    heldMilestoneRef.current = milestone.id;
    setCurrentProblem(
      drawProblem(
        unlockedRef.current,
        problemSeqRef.current,
        undefined,
        undefined,
        recentAnswersRef.current,
        unlockedAdditionRef.current,
        unlockedSubtractionRef.current,
        unlockedDivisionRef.current,
        arenaRef.current.operations,
        milestone,
      ),
    );
    setAnswer("");
    setFeedback("idle");
    setLastDamage(null);
    setTimerRun((run) => run + 1);
  }

  // A correct answer deals damage to the current enemy and earns cards.
  function enterDigit(digit: string) {
    if (!currentProblem) return;

    const nextAnswer = `${answer}${digit}`.slice(0, 4);
    setAnswer(nextAnswer);
    if (Number(nextAnswer) !== currentProblem.answer) return;

    const problem = currentProblem;
    setFeedback("correct");
    recordAttempt(Number(nextAnswer), true);
    grantCards(problem);

    const damage = problem.operation !== "multiplication"
      ? rollProblemDamage(levelOf(problem.skillId), levelOf(problem.skillId))
      : rollProblemDamage(
          levelOf(multiplicationSkillId(problem.operandA)),
          levelOf(multiplicationSkillId(problem.operandB)),
        );
    setLastDamage({ amount: damage, crit: false, kind: "deal", key: Date.now() });
    monsterHpRef.current -= damage;

    if (monsterHpRef.current <= 0) {
      // Enemy defeated: show it drop, then advance to the next enemy in the wave.
      setMonsterHp(0);
      const cleared = enemyIndex + 1;
      window.setTimeout(() => {
        if (cleared >= waveLength) {
          finishMatch(true);
          return;
        }
        const nextEnemyHp = enemyHpForArena(arenaRef.current, cleared);
        monsterHpRef.current = nextEnemyHp;
        monsterMaxHpRef.current = nextEnemyHp;
        setMonsterHp(nextEnemyHp);
        setEnemyIndex(cleared);
        nextProblem();
      }, 260);
      return;
    }

    // Enemy survives; it does NOT hit back on a correct partial hit.
    setMonsterHp(monsterHpRef.current);
    window.setTimeout(() => nextProblem(), 240);
  }

  // A timeout is a miss: the current enemy hits the player.
  function handleTimerEnd() {
    if (isInputLocked || !currentProblem) return;

    const typedAnswer = answer.trim() ? Number(answer) : null;
    recordAttempt(typedAnswer, false);

    const result = resolveMiss(playerHealthRef.current);
    playerHealthRef.current = result.remainingHealth;
    setPlayerHealth(result.remainingHealth);
    setFeedback("timeout");
    setLastDamage({ amount: result.damage, crit: result.isCrit, kind: "take", key: Date.now() });
    setAnswer("");

    if (result.remainingHealth <= 0) {
      window.setTimeout(() => finishMatch(false), 520);
      return;
    }

    window.setTimeout(() => nextProblem(), 520);
  }

  function recordAttempt(studentAnswer: number | null, isCorrect: boolean) {
    if (!currentProblem) return;

    const nextAttempt: Attempt = {
      operation: currentProblem.operation,
      skillId: currentProblem.skillId,
      operandA: currentProblem.operandA,
      operandB: currentProblem.operandB,
      operandC: currentProblem.operandC,
      expectedAnswer: currentProblem.answer,
      studentAnswer,
      isCorrect,
      xpEarned: isCorrect ? 10 : studentAnswer === null ? 0 : 2,
      timeMs: Math.max(0, Date.now() - problemStartedAtRef.current),
    };

    attemptsRef.current = [...attemptsRef.current, nextAttempt];

    // Feed the anti-speedrun ramp. Buffer, not window: the spare samples are
    // what slide in to replace a forgiven miss.
    const sample: AnswerSample = {
      correct: isCorrect,
      timeTakenSeconds: nextAttempt.timeMs / 1000,
      secondsAllowed: currentProblem.secondsAllowed,
    };
    recentAnswersRef.current = [...recentAnswersRef.current, sample].slice(-RAMP_BUFFER);
    // Unwindowed copy: the persisted speed summary describes the whole battle.
    allAnswersRef.current = [...allAnswersRef.current, sample];
  }

  function grantCards(problem: Problem) {
    const tally = cardTallyRef.current;
    const skills = problem.operation !== "multiplication"
      ? [problem.skillId]
      : [multiplicationSkillId(problem.operandA), multiplicationSkillId(problem.operandB)];
    for (const skillId of skills) tally[skillId] = (tally[skillId] ?? 0) + 1;
  }

  async function finishMatch(survived: boolean) {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    setPhase(survived ? "victory" : "defeat");
    if (!survived) setAdCountdown(TEACHING_AD_SECONDS);

    const completedAttempts = attemptsRef.current;
    const correctCount = completedAttempts.filter((attempt) => attempt.isCorrect).length;
    const incorrectCount = completedAttempts.length - correctCount;
    const xpEarned = completedAttempts.reduce((total, attempt) => total + attempt.xpEarned, 0);
    const coinsEarned = correctCount * 10;

    setSummary({
      survived,
      correctCount,
      incorrectCount,
      xpEarned,
      coinsEarned,
      enemiesDefeated: survived ? waveLength : enemyIndex,
      cards: { ...cardTallyRef.current },
      chestStatus: "pending",
      levelsGained: 0,
      chestsAwarded: 0,
      levelUpChests: [],
    });
    setLevelUpChestIndex(0);

    const profileId = getActiveProfileId();
    if (!supabase || !profileId) {
      setSummary((prev) => (prev ? { ...prev, chestStatus: "missed" } : prev));
      return;
    }

    try {
      // Match chest: survived + ≥1 correct (needs a free slot).
      // Level-up chests: one per profile level, opened immediately via modal (no slot needed).
      const matchChestEligible = survived && correctCount >= 1;
      const selectedNumbers = Array.from(
        new Set(completedAttempts.filter((attempt) => attempt.operation === "multiplication").flatMap((attempt) => [attempt.operandA, attempt.operandB])),
      ).sort((a, b) => a - b);
      const operations = Array.from(new Set(completedAttempts.map((attempt) => attempt.operation)));

      const { data: match, error: matchError } = await supabase
        .from("matches")
        .insert({
          profile_id: profileId,
          selected_numbers: selectedNumbers.length ? selectedNumbers : STARTING_UNLOCKED_NUMBERS,
          correct_count: correctCount,
          incorrect_count: incorrectCount,
          duration_ms: Math.max(0, Date.now() - roundStartedAtRef.current),
          xp_earned: xpEarned,
          coins_earned: coinsEarned,
          chest_earned: false,
          operations: operations.length ? operations : arenaRef.current.operations,
        })
        .select()
        .single();

      if (matchError) throw matchError;

      if (completedAttempts.length) {
        const { error: attemptsError } = await supabase.from("problem_attempts").insert(
          completedAttempts.map((attempt, attempt_order) => ({
            match_id: match.id,
            profile_id: profileId,
            operation: attempt.operation,
            skill_id: attempt.skillId,
            operand_a: attempt.operandA,
            operand_b: attempt.operandB,
            operand_c: attempt.operandC,
            expected_answer: attempt.expectedAnswer,
            student_answer: attempt.studentAnswer,
            is_correct: attempt.isCorrect,
            time_ms: attempt.timeMs,
            attempt_order,
          })),
        );

        if (attemptsError) throw attemptsError;
      }

      if (survived) await recordSpeedProfile(profileId, match.id);
      else if (arenaRef.current.missionType === "boss") {
        const reset = await resetWorldProgressAfterBossLoss(profileId, arenaRef.current.worldId);
        if (reset) setWorldProgressReset(true);
      }

      await grantCardTally(profileId, cardTallyRef.current);

      let matchChestsAwarded = 0;
      if (matchChestEligible) {
        matchChestsAwarded = await fillEmptyChestSlots(profileId, 1, match.id, completedAttempts, arenaRef.current);
      }

      const xpResult = await addProfileXp(profileId, xpEarned);
      const levelUpChests: LevelUpChestOffer[] = [];
      for (let i = 1; i <= xpResult.levelsGained; i += 1) {
        const rewards = await rollChestRewardPayloads(profileId, completedAttempts, arenaRef.current);
        levelUpChests.push({
          toLevel: xpResult.fromLevel + i,
          rewards,
          opened: false,
          claimed: [],
        });
      }

      await addProfileCoins(profileId, coinsEarned);
      await incrementMatchesPlayed(profileId);

      const chestWanted = matchChestEligible;
      const chestEarned = matchChestsAwarded > 0 || levelUpChests.length > 0;
      if (chestEarned) {
        await supabase.from("matches").update({ chest_earned: true }).eq("id", match.id);
      }

      const chestStatus: ChestStatus = matchChestsAwarded > 0
        ? "earned"
        : chestWanted
          ? "full"
          : levelUpChests.length > 0
            ? "earned"
            : "missed";

      setSummary((prev) =>
        prev
          ? {
              ...prev,
              chestStatus,
              levelsGained: xpResult.levelsGained,
              chestsAwarded: matchChestsAwarded + levelUpChests.length,
              levelUpChests,
            }
          : prev,
      );
    } catch (error) {
      console.error(error);
      setSummary((prev) => (prev ? { ...prev, chestStatus: "error" } : prev));
    }
  }

  /**
   * Persist how fast the student was: a history row for this battle, and the
   * per-arena profile the NEXT battle reads. The saved carry milestone is one
   * tier below where they ended, so every battle still opens with a little
   * slack and the student re-earns their ceiling in the first few problems.
   *
   * Speed data is supplementary — a failure here must not fail the match save,
   * so this swallows its own errors.
   */
  async function recordSpeedProfile(profileId: string, matchId: string) {
    if (!supabase) return;

    const samples = allAnswersRef.current;
    if (!samples.length) return;

    const stats = summarizeMatchSpeed(samples, recentAnswersRef.current, heldMilestoneRef.current);
    const arenaId = arenaRef.current.id;

    try {
      await supabase.from("match_speed_stats").insert({
        match_id: matchId,
        profile_id: profileId,
        arena_id: arenaId,
        starting_milestone_id: startingMilestoneRef.current,
        ending_milestone_id: stats.endingMilestoneId,
        carry_milestone_id: stats.carryMilestoneId,
        attempts: stats.attempts,
        correct_count: stats.correctCount,
        accuracy: Number(stats.accuracy.toFixed(3)),
        fast_count: stats.fastCount,
        fast_rate: Number(stats.fastRate.toFixed(3)),
        median_time_seconds: Number(stats.medianTimeSeconds.toFixed(2)),
        average_clock_used: Number(stats.averageClockUsed.toFixed(3)),
      });

      const { data: existing } = await supabase
        .from("arena_speed_profiles")
        .select("battles_recorded")
        .eq("profile_id", profileId)
        .eq("arena_id", arenaId)
        .maybeSingle();

      await supabase.from("arena_speed_profiles").upsert(
        {
          profile_id: profileId,
          arena_id: arenaId,
          ending_milestone_id: stats.endingMilestoneId,
          carry_milestone_id: stats.carryMilestoneId,
          carry_multiplier: stats.carryMultiplier,
          battles_recorded: (existing?.battles_recorded ?? 0) + 1,
          last_fast_rate: Number(stats.fastRate.toFixed(3)),
          last_accuracy: Number(stats.accuracy.toFixed(3)),
          last_median_time_seconds: Number(stats.medianTimeSeconds.toFixed(2)),
          last_battle_at: new Date().toISOString(),
        },
        { onConflict: "profile_id,arena_id" },
      );
    } catch (error) {
      console.error("speed profile save failed", error);
    }
  }

  function handleKey(key: string) {
    if (isInputLocked) return;

    if (key === "Backspace") {
      setAnswer((value) => value.slice(0, -1));
      return;
    }

    enterDigit(key);
  }

  const playShellClass = useMemo(() => {
    if (phase === "victory") return "play-shell is-complete";
    if (phase === "defeat") return "play-shell is-defeat";
    if (phase === "intro") return "play-shell is-intro";
    return `play-shell ${feedback !== "idle" ? `is-${feedback}` : ""}`;
  }, [feedback, phase]);

  // Most-missed fact, used to target the teaching video shown on defeat.
  const teachingFact = useMemo(() => {
    const misses = new Map<string, { attempt: Attempt; count: number }>();
    for (const attempt of attemptsRef.current) {
      if (attempt.isCorrect) continue;
      const key = `${attempt.operation}:${attempt.operandA}:${attempt.operandB}:${attempt.operandC ?? ""}`;
      const entry = misses.get(key) ?? { attempt, count: 0 };
      entry.count += 1;
      misses.set(key, entry);
    }
    return Array.from(misses.values()).sort((a, b) => b.count - a.count)[0] ?? null;
  }, [phase]);

  const playerHealthPct = Math.max(0, Math.round((playerHealth / PLAYER_MAX_HEALTH) * 100));
  const monsterHealthPct = Math.max(0, Math.round((monsterHp / Math.max(1, monsterMaxHpRef.current)) * 100));

  const summaryAttempts = (summary?.correctCount ?? 0) + (summary?.incorrectCount ?? 0);
  const summaryAccuracy = summaryAttempts ? Math.round(((summary?.correctCount ?? 0) / summaryAttempts) * 100) : 0;
  const summaryCards = summary
    ? (() => {
        let multiplicationCards = 0;
        const other: Array<{ skillId: string; count: number; gem: string; title: string; sort: number }> = [];
        for (const [skillId, count] of Object.entries(summary.cards)) {
          if (count <= 0) continue;
          if (skillId.startsWith("multiplication.")) {
            multiplicationCards += count;
            continue;
          }
          other.push({ skillId, count, ...summaryCardMeta(skillId) });
        }
        other.sort((a, b) => a.sort - b.sort);
        if (multiplicationCards > 0) {
          other.unshift({
            skillId: "multiplication",
            count: multiplicationCards,
            gem: "×",
            title: "Multiplication cards",
            sort: 0,
          });
        }
        return other;
      })()
    : [];

  const hasPendingLevelUpChests = Boolean(summary?.levelUpChests.some((chest) => !chest.opened));
  const activeLevelUpChest = summary?.levelUpChests[levelUpChestIndex] ?? null;
  const levelUpModalVisible = Boolean(
    summary &&
      summary.chestStatus !== "pending" &&
      activeLevelUpChest &&
      levelUpChestIndex < summary.levelUpChests.length,
  );
  const savingRewards = summary?.chestStatus === "pending";
  const canLeave = !savingRewards && !hasPendingLevelUpChests;

  function leaveMatch() {
    if (!canLeave) return;
    const status = summary && summary.chestStatus !== "pending" ? summary.chestStatus : "missed";
    router.replace(`/7math?chest=${status}`);
  }

  function leaveAfterBossDefeat() {
    if (savingRewards || hasPendingLevelUpChests || adCountdown > 0) return;
    router.replace(worldProgressReset ? "/7math?bossReset=1" : "/7math");
  }

  async function openLevelUpChest() {
    if (!summary || openingLevelUpChest) return;
    const profileId = getActiveProfileId();
    const offer = summary.levelUpChests[levelUpChestIndex];
    if (!profileId || !offer || offer.opened) return;

    setOpeningLevelUpChest(true);
    try {
      const claimed = await claimLevelUpChestRewards(profileId, offer.rewards);
      setSummary((prev) => {
        if (!prev) return prev;
        const levelUpChests = prev.levelUpChests.map((chest, index) =>
          index === levelUpChestIndex ? { ...chest, opened: true, claimed } : chest,
        );
        return { ...prev, levelUpChests };
      });
    } catch (error) {
      console.error(error);
      setSummary((prev) => (prev ? { ...prev, chestStatus: "error" } : prev));
    } finally {
      setOpeningLevelUpChest(false);
    }
  }

  function advanceLevelUpChest() {
    setLevelUpChestIndex((index) => index + 1);
  }

  return (
    <main className={playShellClass}>
      {levelUpModalVisible && activeLevelUpChest && (
        <div className="signin-overlay levelup-chest-overlay" role="dialog" aria-modal="true" aria-labelledby="levelup-chest-title">
          <div className="signin-card chest-modal levelup-chest-modal">
            <p className="levelup-chest-flag">Profile Level Up</p>
            <h1 id="levelup-chest-title">Level {activeLevelUpChest.toLevel}</h1>
            {!activeLevelUpChest.opened ? (
              <>
                <div className="levelup-chest-art" aria-hidden="true">
                  <span />
                </div>
                <p>Claim your level-up chest. No slot needed — open it now.</p>
                <button disabled={openingLevelUpChest} onClick={openLevelUpChest}>
                  {openingLevelUpChest ? "OPENING…" : "OPEN CHEST"}
                </button>
              </>
            ) : (
              <>
                <ul className="levelup-chest-rewards">
                  {activeLevelUpChest.claimed.map((label, index) => (
                    <li key={`${label}-${index}`}>{label}</li>
                  ))}
                </ul>
                {levelUpChestIndex + 1 < (summary?.levelUpChests.length ?? 0) ? (
                  <button onClick={advanceLevelUpChest}>NEXT CHEST</button>
                ) : (
                  <button onClick={advanceLevelUpChest}>NICE!</button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {phase === "combat" && currentProblem && (
        <div className="play-timer" aria-hidden="true">
          <div
            key={`${currentProblem.id}-${timerRun}`}
            onAnimationEnd={handleTimerEnd}
            style={{ animationDuration: `${currentProblem.secondsAllowed}s` }}
          />
        </div>
      )}

      {phase === "victory" ? (
        <section className="match-summary" aria-label="Match summary">
          <h1>Wave Cleared!</h1>
          <div className="summary-grid">
            <div className="summary-stat">
              <span>Enemies</span>
              <strong>{summary ? `${summary.enemiesDefeated}/${waveLength}` : "—"}</strong>
            </div>
            <div className="summary-stat">
              <span>Correct</span>
              <strong>{summary?.correctCount ?? 0}</strong>
            </div>
            <div className="summary-stat">
              <span>Missed</span>
              <strong>{summary?.incorrectCount ?? 0}</strong>
            </div>
            <div className="summary-stat">
              <span>Accuracy</span>
              <strong>{summaryAccuracy}%</strong>
            </div>
            <div className="summary-stat">
              <span>XP</span>
              <strong>+{summary?.xpEarned ?? 0}</strong>
            </div>
            <div className="summary-stat">
              <span>Coins</span>
              <strong>+{summary?.coinsEarned ?? 0}</strong>
            </div>
          </div>

          <p className={`summary-chest chest-${summary?.chestStatus ?? "pending"}`}>
            {summaryRewardMessage(summary)}
          </p>

          <div className="summary-cards">
            <h2>Cards Collected</h2>
            {summaryCards.length ? (
              <div className="summary-card-chips">
                {summaryCards.map(({ skillId, count, gem, title }) => (
                  <span className="summary-card-chip" key={skillId} title={title}>
                    <i className="summary-card-gem">{gem}</i>
                    <b>+{count}</b>
                  </span>
                ))}
              </div>
            ) : (
              <p className="summary-cards-empty">No cards this match.</p>
            )}
          </div>

          <button className="summary-continue" disabled={!canLeave} onClick={leaveMatch}>
            {savingRewards ? "SAVING…" : hasPendingLevelUpChests ? "OPEN CHEST…" : "CONTINUE"}
          </button>
        </section>
      ) : phase === "defeat" ? (
        <section className="teaching-ad" aria-label="Quick lesson">
          <p className="teaching-ad-flag">Sponsored Lesson</p>
          <h1>Let&apos;s master this one</h1>
          {worldProgressReset ? (
            <p className="teaching-ad-hint">
              Boss win needed — {arena.worldTitle} progress reset. Clear the world again to retry the boss.
            </p>
          ) : null}
          {teachingFact ? (
            <div className="teaching-ad-body">
              <p className="teaching-ad-fact">
                {formatAttemptEquation(teachingFact.attempt)}
              </p>
              <p className="teaching-ad-hint">
                {teachingHint(teachingFact.attempt)}
              </p>
              <div className="teaching-ad-skip">
                {teachingSteps(teachingFact.attempt).map((step, i) => <span key={i}>{step}</span>)}
              </div>
            </div>
          ) : (
            <p className="teaching-ad-hint">Keep practicing your facts to hit harder next time.</p>
          )}
          <button
            className="teaching-ad-retry"
            disabled={adCountdown > 0 || hasPendingLevelUpChests || savingRewards}
            onClick={() => {
              if (arena.missionType === "boss") leaveAfterBossDefeat();
              else window.location.reload();
            }}
          >
            {savingRewards
              ? "SAVING…"
              : hasPendingLevelUpChests
                ? "OPEN CHEST…"
                : adCountdown > 0
                  ? `Retry in ${adCountdown}s`
                  : arena.missionType === "boss"
                    ? worldProgressReset
                      ? "Back to map"
                      : "Leave"
                    : "Play again"}
          </button>
        </section>
      ) : phase === "intro" ? (
        wave ? (
          <section className="intro-screen" aria-label="Wave intro" onClick={startCombat}>
          <p className="intro-count">
              <span>{wave.length}</span> ENEMIES INCOMING
            </p>
            <p className="intro-arena">{arena.title}</p>
            {startingMilestoneLabel !== "Warmup" ? (
              <p className="intro-speed">Starting speed: {startingMilestoneLabel}</p>
            ) : null}
            <div className="intro-lane">
              <div className="intro-fighter player">
                <img src={`/sprites/${playerSprite}.png`} alt="You" />
                <span>YOU</span>
              </div>
              <div className="intro-vs">VS</div>
              <div className="intro-fighter foe">
                {introStep < wave.length ? (
                  <img key={introStep} className="intro-flash" src={`/sprites/${wave[introStep]}.png`} alt="" />
                ) : (
                  <div className="intro-fight">FIGHT!</div>
                )}
              </div>
            </div>
            <div className="intro-roster" aria-label={`${wave.length} enemies`}>
              {wave.map((sprite, i) => (
                <img
                  key={i}
                  className={`intro-chip ${i < introStep ? "seen" : ""} ${i === introStep ? "active" : ""}`}
                  src={`/sprites/${sprite}.png`}
                  alt=""
                />
              ))}
            </div>
            <p className="intro-hint">Tap to start</p>
          </section>
        ) : (
          <section className="play-stage" aria-label="Loading match">
            <div className="play-problem">
              <span>?</span>
              <span>x</span>
              <span>?</span>
            </div>
          </section>
        )
      ) : !currentProblem ? (
        <section className="play-stage" aria-label="Loading round">
          <div className="play-problem">
            <span>?</span>
            <span>x</span>
            <span>?</span>
          </div>
        </section>
      ) : (
        <section className="play-stage" aria-label="Math problem">
          <div className="combat-hud" aria-label="Health">
            <div className="hud-side">
              <span className="hud-name">YOU</span>
              <div className="health-bar">
                <div className="health-fill player" style={{ width: `${playerHealthPct}%` }} />
              </div>
              <span className="hud-value">{playerHealth}</span>
            </div>
            <div className="hud-progress" aria-label="Wave progress">
              {Math.min(enemyIndex + 1, waveLength)}/{waveLength}
            </div>
            <div className="hud-side hud-side-right">
              <span className="hud-name">FOE</span>
              <div className="health-bar">
                <div className="health-fill monster" style={{ width: `${monsterHealthPct}%` }} />
              </div>
              <span className="hud-value">{Math.max(0, monsterHp)}</span>
            </div>
          </div>

          <div className="battle-lane" aria-label={`Player ${playerSprite} versus ${challengerSprite}`}>
            <div className="battle-fighter player-fighter">
              <img src={`/sprites/${playerSprite}.png`} alt="Player character" />
              <span>YOU</span>
            </div>
            <div className="battle-vs">
              VS
              {lastDamage && (
                <span key={lastDamage.key} className={`damage-pop ${lastDamage.kind} ${lastDamage.crit ? "crit" : ""}`}>
                  -{lastDamage.amount}
                  {lastDamage.crit ? "!" : ""}
                </span>
              )}
            </div>
            <div className="battle-fighter challenger-fighter">
              <img src={`/sprites/${challengerSprite}.png`} alt="Monster" />
              <span>{challengerSprite.toUpperCase()}</span>
            </div>
          </div>
          <div className="play-problem">
            <span>{currentProblem.operandA}</span>
            <span>{currentProblem.operation === "addition" ? "+" : currentProblem.operation === "subtraction" ? "−" : currentProblem.operation === "division" ? "÷" : "×"}</span>
            <span>{currentProblem.operandB}</span>
            {currentProblem.operandC !== null && <><span>+</span><span>{currentProblem.operandC}</span></>}
          </div>

          <div className="play-answer" role="textbox" aria-label="Answer" aria-live="polite">
            {answer || "?"}
          </div>

          <NumberPad className="play-keypad" disabled={isInputLocked} onKey={handleKey} />
        </section>
      )}
    </main>
  );
}

async function grantCardTally(profileId: string, tally: Record<string, number>) {
  if (!supabase) return;
  const skillIds = Object.keys(tally).filter((skillId) => tally[skillId] > 0);
  if (!skillIds.length) return;

  const { data: existing, error } = await supabase
    .from("skill_cards")
    .select("skill_id, operation, card_count, level")
    .eq("profile_id", profileId)
    .in("skill_id", skillIds);
  if (error) throw error;

  const current = new Map((existing ?? []).map((row) => [row.skill_id, row]));
  const rows = skillIds.map((skillId) => {
    const prior = current.get(skillId);
    return {
      profile_id: profileId,
      skill_id: skillId,
      operation: operationForSkillId(skillId),
      card_count: clampCardCount((prior?.card_count ?? 0) + tally[skillId]),
      level: prior?.level ?? 1,
    };
  });

  const { error: upsertError } = await supabase
    .from("skill_cards")
    .upsert(rows, { onConflict: "profile_id,skill_id" });
  if (upsertError) throw upsertError;
}

/**
 * Losing a boss wipes that world's arena completions (and speed carry) so the
 * student must clear e.g. World 2-1 … 2-5 again before retrying 2-B.
 * Prior worlds are left alone. Returns true when at least one row was targeted.
 */
async function resetWorldProgressAfterBossLoss(profileId: string, worldId: string): Promise<boolean> {
  if (!supabase) return false;

  const arenaIds = worldArenaIds(worldId);
  if (!arenaIds.length) return false;

  try {
    const [{ error: statsError }, { error: profilesError }] = await Promise.all([
      supabase.from("match_speed_stats").delete().eq("profile_id", profileId).in("arena_id", arenaIds),
      supabase.from("arena_speed_profiles").delete().eq("profile_id", profileId).in("arena_id", arenaIds),
    ]);

    if (statsError) throw statsError;
    if (profilesError) throw profilesError;
    return true;
  } catch (error) {
    console.error("world progress reset failed", error);
    return false;
  }
}

async function addProfileXp(profileId: string, xpEarned: number): Promise<{ fromLevel: number; levelsGained: number }> {
  if (!supabase || xpEarned <= 0) return { fromLevel: 1, levelsGained: 0 };

  const { data: profile, error: lookupError } = await supabase
    .from("profiles")
    .select()
    .eq("id", profileId)
    .single();

  if (lookupError) throw lookupError;

  const previousLevel = Math.max(profile.level, getProfileLevelFromXp(profile.xp));
  const nextXp = profile.xp + xpEarned;
  const nextLevel = getProfileLevelFromXp(nextXp);
  const appliedLevel = Math.max(profile.level, nextLevel);
  const { error } = await supabase
    .from("profiles")
    .update({ xp: nextXp, level: appliedLevel })
    .eq("id", profileId);

  if (error) throw error;
  return { fromLevel: previousLevel, levelsGained: Math.max(0, appliedLevel - previousLevel) };
}

async function addProfileCoins(profileId: string, coinsEarned: number) {
  if (!supabase || coinsEarned <= 0) return;

  const { data: profile, error: lookupError } = await supabase
    .from("profiles")
    .select("coins")
    .eq("id", profileId)
    .single();

  if (lookupError) throw lookupError;

  const { error } = await supabase
    .from("profiles")
    .update({ coins: profile.coins + coinsEarned })
    .eq("id", profileId);

  if (error) throw error;
}

async function findEmptyChestSlot(profileId: string) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("chest_slots")
    .select()
    .eq("profile_id", profileId)
    .eq("state", "empty")
    .order("slot_index")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Fill up to `count` empty chest slots. Returns how many were awarded. */
async function fillEmptyChestSlots(profileId: string, count: number, matchId: string, attempts: Attempt[], arena: OperationArena): Promise<number> {
  let awarded = 0;
  for (let i = 0; i < count; i += 1) {
    const slot = await findEmptyChestSlot(profileId);
    if (!slot) break;
    await fillChestSlot(profileId, slot.id, matchId, attempts, arena);
    awarded += 1;
  }
  return awarded;
}

async function fillChestSlot(profileId: string, chestId: string, matchId: string, attempts: Attempt[], arena: OperationArena) {
  if (!supabase) return;

  const now = new Date().toISOString();
  const rarity = rollRewardRarity(arena.rewardRarityChances);
  const { error } = await supabase
    .from("chest_slots")
    .update({
      state: "waiting",
      rarity,
      reward_type: null,
      reward_coins: null,
      reward_number: null,
      reward_card_count: null,
      earned_at: now,
      ready_at: null,
      unlock_started_at: null,
      opened_at: null,
    })
    .eq("id", chestId);

  if (error) throw error;

  const payloads = await rollChestRewardPayloads(profileId, attempts, arena, rarity);
  const rewards = payloads.map((reward, reward_order) => ({
    chest_id: chestId,
    reward_order,
    reward_type: reward.reward_type,
    operation: reward.operation,
    skill_id: reward.skill_id,
    coin_amount: reward.coin_amount,
    card_amount: reward.card_amount,
    source_match_id: matchId,
  }));

  const { error: rewardError } = await supabase.from("chest_rewards").insert(rewards);
  if (rewardError) throw rewardError;
}

function rollRewardRarity(weights: Record<Rarity, number>): Rarity {
  const entries = Object.entries(weights) as Array<[Rarity, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  let roll = Math.random() * Math.max(1, total);
  for (const [rarity, weight] of entries) {
    roll -= Math.max(0, weight);
    if (roll <= 0) return rarity;
  }
  return "common";
}

function rewardTuningForRarity(rarity: Rarity) {
  const tuning: Record<Rarity, { coins: number; cards: number; cardChance: number }> = {
    common: { coins: 250, cards: 10, cardChance: 0.5 },
    rare: { coins: 350, cards: 15, cardChance: 0.65 },
    epic: { coins: 500, cards: 25, cardChance: 0.8 },
    legendary: { coins: 800, cards: 40, cardChance: 1 },
  };
  return tuning[rarity];
}

async function rollChestRewardPayloads(profileId: string, attempts: Attempt[], arena: OperationArena, forcedRarity?: Rarity): Promise<LevelUpChestReward[]> {
  if (!supabase) return [{ reward_type: "coins", operation: null, skill_id: null, coin_amount: 250, card_amount: null }];
  const rarity = forcedRarity ?? rollRewardRarity(arena.rewardRarityChances);
  const tuning = rewardTuningForRarity(rarity);

  const rewards: LevelUpChestReward[] = [{
    reward_type: "coins",
    operation: null,
    skill_id: null,
    coin_amount: tuning.coins,
    card_amount: null,
  }];

  const { data: unlocked, error: skillError } = await supabase
    .from("skill_cards")
    .select("skill_id, operation")
    .eq("profile_id", profileId);
  if (skillError) throw skillError;
  const unlockedIds = new Set((unlocked ?? []).map((skill) => skill.skill_id));
  const practiced = (operation: Operation) =>
    attempts.filter((attempt) => attempt.operation === operation && unlockedIds.has(attempt.skillId));

  for (const operation of ["multiplication", "addition", "subtraction", "division"] as const) {
    const candidates = practiced(operation);
    if (candidates.length && Math.random() < tuning.cardChance) {
      const missed = candidates.filter((attempt) => !attempt.isCorrect);
      const pool = operation !== "multiplication" && missed.length ? missed : candidates;
      const target = pool[Math.floor(Math.random() * pool.length)];
      rewards.push({
        reward_type: "cards",
        operation,
        skill_id: target.skillId,
        coin_amount: null,
        card_amount: tuning.cards,
      });
    }
  }

  // A chest carries at most one unlock. Multiplication numbers and addition/
  // subtraction concepts both compete for that slot; when both are available we
  // coin-flip so neither track starves the other.
  const nextNumber = await findUnlockableNumber(profileId, rarity);
  const nextSkill = await findMasteryEligibleSkill(profileId, unlockedIds);
  const takeNumber = nextNumber !== null && (!nextSkill || Math.random() < 0.5);

  if (takeNumber) {
    rewards.push({
      reward_type: "unlock",
      operation: "multiplication",
      skill_id: multiplicationSkillId(nextNumber!),
      coin_amount: null,
      card_amount: null,
    });
  } else if (nextSkill) {
    rewards.push({
      reward_type: "unlock",
      operation: nextSkill.operation,
      skill_id: nextSkill.skillId,
      coin_amount: null,
      card_amount: null,
    });
  } else if (rewards.length === 1) {
    rewards[0].coin_amount = tuning.coins + 150;
  }

  return rewards;
}

/** Roll a still-locked multiplication number this chest's rarity is allowed to grant. */
async function findUnlockableNumber(profileId: string, rarity: Rarity): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("student_progress")
    .select("unlocked_numbers")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return rollNumberUnlock(rarity, data?.unlocked_numbers ?? STARTING_UNLOCKED_NUMBERS);
}

/** Add a multiplication number to student_progress.unlocked_numbers. Returns false if already owned. */
async function unlockMultiplicationNumber(profileId: string, number: number): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("student_progress")
    .select("unlocked_numbers")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;

  const current = data?.unlocked_numbers ?? STARTING_UNLOCKED_NUMBERS;
  if (current.includes(number)) return false;

  const { error: updateError } = await supabase
    .from("student_progress")
    .update({ unlocked_numbers: [...current, number].sort((a, b) => a - b) })
    .eq("profile_id", profileId);
  if (updateError) throw updateError;

  // Seed the card row so the number shows up at level 1 in the collection.
  await grantPlaySkillCards(profileId, multiplicationSkillId(number), "multiplication", 0);
  return true;
}

async function claimLevelUpChestRewards(profileId: string, rewards: LevelUpChestReward[]): Promise<string[]> {
  if (!supabase) return [];

  const claimed: string[] = [];
  let bonusCoins = 0;

  for (const reward of rewards) {
    if (reward.reward_type === "coins") {
      bonusCoins += reward.coin_amount ?? 0;
      claimed.push(rewardLabel(reward));
      continue;
    }

    if (reward.reward_type === "cards" && reward.skill_id && reward.operation) {
      const { data: existing } = await supabase
        .from("skill_cards")
        .select("skill_id")
        .eq("profile_id", profileId)
        .eq("skill_id", reward.skill_id)
        .maybeSingle();

      if (existing) {
        await grantPlaySkillCards(profileId, reward.skill_id, reward.operation, reward.card_amount ?? 0);
        claimed.push(rewardLabel(reward));
      } else {
        bonusCoins += 150;
        claimed.push("+150 coins");
      }
      continue;
    }

    if (reward.reward_type === "unlock" && reward.skill_id && reward.operation) {
      // Multiplication numbers are gated by student_progress.unlocked_numbers,
      // not by the presence of a skill_cards row.
      if (reward.operation === "multiplication") {
        const number = Number(reward.skill_id.match(/^multiplication\.row\.(\d+)$/)?.[1]);
        if (Number.isFinite(number) && (await unlockMultiplicationNumber(profileId, number))) {
          claimed.push(rewardLabel(reward));
        } else {
          bonusCoins += 250;
          claimed.push("+250 coins");
        }
        continue;
      }

      const { data: existing } = await supabase
        .from("skill_cards")
        .select("skill_id")
        .eq("profile_id", profileId)
        .eq("skill_id", reward.skill_id)
        .maybeSingle();

      if (!existing) {
        await grantPlaySkillCards(profileId, reward.skill_id, reward.operation, 0);
        claimed.push(rewardLabel(reward));
      } else {
        bonusCoins += 250;
        claimed.push("+250 coins");
      }
    }
  }

  if (bonusCoins > 0) await addProfileCoins(profileId, bonusCoins);
  return claimed;
}

async function grantPlaySkillCards(
  profileId: string,
  skillId: string,
  operation: Operation,
  amount: number,
) {
  if (!supabase || amount < 0) return;

  const { data: existing, error: lookupError } = await supabase
    .from("skill_cards")
    .select("card_count, level")
    .eq("profile_id", profileId)
    .eq("skill_id", skillId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const { error } = await supabase.from("skill_cards").upsert(
    {
      profile_id: profileId,
      skill_id: skillId,
      operation,
      card_count: clampCardCount((existing?.card_count ?? 0) + amount),
      level: existing?.level ?? 1,
    },
    { onConflict: "profile_id,skill_id" },
  );
  if (error) throw error;
}

async function findMasteryEligibleSkill(profileId: string, unlockedIds: Set<string>) {
  if (!supabase) return null;
  for (const operation of ["addition", "subtraction"] as const) {
    const next = SKILLS_BY_OPERATION[operation].find((skill) => !unlockedIds.has(skill.id) && (!skill.prerequisiteId || unlockedIds.has(skill.prerequisiteId)));
    if (!next?.prerequisiteId) continue;
    const { data, error } = await supabase.from("problem_attempts")
      .select("is_correct").eq("profile_id", profileId).eq("skill_id", next.prerequisiteId)
      .order("created_at", { ascending: false }).limit(10);
    if (error) throw error;
    if ((data?.length ?? 0) >= 10 && (data ?? []).filter((row) => row.is_correct).length >= 8) {
      return { operation, skillId: next.id };
    }
  }
  return null;
}

async function incrementMatchesPlayed(profileId: string) {
  if (!supabase) return;

  const { data: progress, error: lookupError } = await supabase
    .from("student_progress")
    .select()
    .eq("profile_id", profileId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const { error } = await supabase
    .from("student_progress")
    .update({ matches_played: (progress?.matches_played ?? 0) + 1 })
    .eq("profile_id", profileId);

  if (error) throw error;
}
