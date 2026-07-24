"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  COMPLETE_MULTIPLICATION_MAP,
  FIRST_GAME_PROBLEM_POOL,
  FIRST_GAME_QUESTION_COUNT,
  type Problem,
} from "../../lib/gameplay";
import { supabase } from "../../lib/supabase";

type Feedback = "idle" | "correct" | "timeout";
type Attempt = {
  factorA: number;
  factorB: number;
  studentAnswer: number | null;
  isCorrect: boolean;
  xpEarned: number;
  timeMs: number;
};

const spriteNames = [
  "raijin", "phoenix", "pooka", "long", "banshee", "skinwalker", "nian", "jormungandr", "simurgh", "naga",
  "hydra", "garuda", "pegasus", "anubis", "valkyrie", "oni", "horus", "griffin", "chupacabra", "fenrir",
  "minotaur", "kitsune", "seraph", "sphynx", "quetzalcoatl",
];

const keypadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

function buildRound() {
  return [...FIRST_GAME_PROBLEM_POOL]
    .sort(() => Math.random() - 0.5)
    .slice(0, FIRST_GAME_QUESTION_COUNT);
}

export default function PlayPage() {
  const router = useRouter();
  const roundStartedAtRef = useRef<number>(Date.now());
  const problemStartedAtRef = useRef<number>(Date.now());
  const isCompletingRef = useRef(false);
  const attemptsRef = useRef<Attempt[]>([]);
  const [roundProblems, setRoundProblems] = useState<Problem[]>(() => buildRound());
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [timerRun, setTimerRun] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [playerSprite, setPlayerSprite] = useState("raijin");
  const [challengerSprite] = useState(() => spriteNames[Math.floor(Math.random() * spriteNames.length)]);

  const currentProblem = roundProblems[Math.min(questionIndex, roundProblems.length - 1)];
  const isInputLocked = feedback !== "idle" || isRoundComplete;

  useEffect(() => {
    if (!sessionStorage.getItem("activeProfileId")) {
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    const profileId = sessionStorage.getItem("activeProfileId");
    if (!supabase || !profileId) return;
    supabase.from("profiles").select("sprite_name").eq("id", profileId).maybeSingle().then(({ data }) => {
      if (data?.sprite_name && spriteNames.includes(data.sprite_name)) setPlayerSprite(data.sprite_name);
    });
  }, []);

  useEffect(() => {
    problemStartedAtRef.current = Date.now();
  }, [currentProblem.id, timerRun]);

  useEffect(() => {
    function handlePhysicalKey(event: KeyboardEvent) {
      if (isInputLocked) return;

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        enterDigit(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setAnswer((value) => value.slice(0, -1));
      }
    }

    window.addEventListener("keydown", handlePhysicalKey);
    return () => window.removeEventListener("keydown", handlePhysicalKey);
  }, [answer, currentProblem.answer, isInputLocked]);

  function advanceQuestion() {
    setAnswer("");
    setFeedback("idle");
    setTimerRun((run) => run + 1);

    setQuestionIndex((index) => {
      const nextIndex = index + 1;
      if (nextIndex >= FIRST_GAME_QUESTION_COUNT) {
        setIsRoundComplete(true);
        finishRound();
        return index;
      }
      return nextIndex;
    });
  }

  function enterDigit(digit: string) {
    const nextAnswer = `${answer}${digit}`.slice(0, 4);
    setAnswer(nextAnswer);

    if (Number(nextAnswer) === currentProblem.answer) {
      setFeedback("correct");
      recordAttempt(Number(nextAnswer), true);
      window.setTimeout(() => advanceQuestion(), 180);
    }
  }

  function handleTimerEnd() {
    if (isInputLocked) return;

    const timedOutAnswer = answer.trim() ? Number(answer) : null;
    setAnswer("");
    setFeedback("timeout");
    recordAttempt(timedOutAnswer, false);
    window.setTimeout(() => advanceQuestion(), 420);
  }

  function recordAttempt(studentAnswer: number | null, isCorrect: boolean) {
    const nextAttempt = {
      factorA: currentProblem.factorA,
      factorB: currentProblem.factorB,
      studentAnswer,
      isCorrect,
      xpEarned: isCorrect ? 10 : studentAnswer === null ? 0 : 2,
      timeMs: Math.max(0, Date.now() - problemStartedAtRef.current),
    };

    attemptsRef.current = [...attemptsRef.current, nextAttempt];
    setAttempts(attemptsRef.current);
  }

  async function finishRound() {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    const profileId = sessionStorage.getItem("activeProfileId");
    if (!supabase || !profileId) {
      router.replace("/");
      return;
    }

    try {
      const completedAttempts = attemptsRef.current;
      const correctCount = completedAttempts.filter((attempt) => attempt.isCorrect).length;
      const incorrectCount = completedAttempts.length - correctCount;
      const chestEarned = completedAttempts.length > 0 && correctCount / completedAttempts.length >= 0.5;
      const xpEarned = completedAttempts.reduce((total, attempt) => total + attempt.xpEarned, 0);
      const selectedNumbers = Array.from(new Set(roundProblems.flatMap((problem) => [problem.factorA, problem.factorB]))).sort((a, b) => a - b);

      const { data: match, error: matchError } = await supabase
        .from("matches")
        .insert({
          profile_id: profileId,
          selected_numbers: selectedNumbers,
          correct_count: correctCount,
          incorrect_count: incorrectCount,
          duration_ms: Math.max(0, Date.now() - roundStartedAtRef.current),
          xp_earned: xpEarned,
          coins_earned: correctCount * 10,
          chest_earned: chestEarned,
        })
        .select()
        .single();

      if (matchError) throw matchError;

      if (completedAttempts.length) {
        const { error: attemptsError } = await supabase.from("problem_attempts").insert(
          completedAttempts.map((attempt, attempt_order) => ({
            match_id: match.id,
            profile_id: profileId,
            factor_a: attempt.factorA,
            factor_b: attempt.factorB,
            student_answer: attempt.studentAnswer,
            is_correct: attempt.isCorrect,
            time_ms: attempt.timeMs,
            attempt_order,
          })),
        );

        if (attemptsError) throw attemptsError;
      }

      if (chestEarned) {
        await awardChest(profileId);
      }
      await addProfileXp(profileId, xpEarned);
      await incrementMatchesPlayed(profileId);
      window.setTimeout(() => router.replace(chestEarned ? "/?chest=earned" : "/?chest=missed"), 450);
    } catch (error) {
      console.error(error);
      window.setTimeout(() => router.replace("/?chest=error"), 450);
    }
  }

  function handleKey(key: string) {
    if (isInputLocked) return;

    if (key === "clear") {
      setAnswer("");
      return;
    }

    if (key === "back") {
      setAnswer((value) => value.slice(0, -1));
      return;
    }

    enterDigit(key);
  }

  const playShellClass = useMemo(() => {
    if (isRoundComplete) return "play-shell is-complete";
    return `play-shell ${feedback !== "idle" ? `is-${feedback}` : ""}`;
  }, [feedback, isRoundComplete]);

  return (
    <main className={playShellClass}>
      {!isRoundComplete && (
        <div className="play-timer" aria-hidden="true">
          <div
            key={`${currentProblem.id}-${timerRun}`}
            onAnimationEnd={handleTimerEnd}
            style={{ animationDuration: `${currentProblem.secondsAllowed}s` }}
          />
        </div>
      )}

      {isRoundComplete ? (
        <section className="play-complete" aria-label="Round complete">
          <h1>Chest Earned</h1>
        </section>
      ) : (
        <section className="play-stage" aria-label="Multiplication problem">
          <div className="battle-lane" aria-label={`Player ${playerSprite} versus ${challengerSprite}`}>
            <div className="battle-fighter player-fighter">
              <img src={`/sprites/${playerSprite}.png`} alt="Player character" />
              <span>YOU</span>
            </div>
            <div className="battle-vs">VS</div>
            <div className="battle-fighter challenger-fighter">
              <img src={`/sprites/${challengerSprite}.png`} alt="Challenger" />
              <span>{challengerSprite.toUpperCase()}</span>
            </div>
          </div>
          <div className="play-problem">
            <span>{currentProblem.factorA}</span>
            <span>x</span>
            <span>{currentProblem.factorB}</span>
          </div>

          <div className="play-answer" role="textbox" aria-label="Answer" aria-live="polite">
            {answer || "?"}
          </div>

          <div className="play-keypad" aria-label="Number pad">
            {keypadKeys.map((key) => (
              <button className={key.length > 1 ? "utility-key" : ""} key={key} onClick={() => handleKey(key)}>
                {key === "back" ? "⌫" : key === "clear" ? "C" : key}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

async function addProfileXp(profileId: string, xpEarned: number) {
  if (!supabase || xpEarned <= 0) return;

  const { data: profile, error: lookupError } = await supabase
    .from("profiles")
    .select()
    .eq("id", profileId)
    .single();

  if (lookupError) throw lookupError;

  const nextXp = profile.xp + xpEarned;
  const nextLevel = Math.floor(nextXp / 1000) + 1;
  const { error } = await supabase
    .from("profiles")
    .update({ xp: nextXp, level: Math.max(profile.level, nextLevel) })
    .eq("id", profileId);

  if (error) throw error;
}

async function awardChest(profileId: string) {
  if (!supabase) return;

  const { data: emptyChest, error: lookupError } = await supabase
    .from("chest_slots")
    .select()
    .eq("profile_id", profileId)
    .eq("state", "empty")
    .order("slot_index")
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (emptyChest) {
    const reward = await rollChestReward(profileId);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("chest_slots")
      .update({
        state: "waiting",
        rarity: "common",
        reward_type: reward.type,
        reward_coins: reward.type === "coins" ? reward.coins : null,
        reward_number: reward.type === "number" ? reward.number : null,
        earned_at: now,
        ready_at: null,
        unlock_started_at: null,
        opened_at: null,
      })
      .eq("id", emptyChest.id);

    if (error) throw error;
  }
}

async function rollChestReward(profileId: string) {
  if (!supabase) return { type: "coins" as const, coins: 250 };

  const { data: progress, error } = await supabase
    .from("student_progress")
    .select()
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;

  const unlockedNumbers = progress?.unlocked_numbers ?? [];
  const lockedNumbers = COMPLETE_MULTIPLICATION_MAP.filter((number) => !unlockedNumbers.includes(number));

  if (!lockedNumbers.length) {
    return { type: "coins" as const, coins: 250 };
  }

  return { type: "number" as const, number: lockedNumbers[Math.floor(Math.random() * lockedNumbers.length)] };
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
