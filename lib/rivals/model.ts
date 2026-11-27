import type { Outcome, Question } from "../mentalist/model";
import { rushLength, type RushGrade } from "../rush/model";

export const queueLeaseMs = 30_000;
export const raceLeaseMs = 60_000;
export const countdownMs = 3_000;
export const raceLimitMs = 600_000;

export type RivalProgress = {
  username: string;
  sprite: string;
  missed: number[];
  resolved: number;
  mistakes: number;
  finishedMs: number | null;
};
export type ResultReason = "finished" | "forfeit" | "deadline" | "abandoned";
export type RivalsState =
  | { phase: "idle" }
  | { phase: "waiting"; grade: RushGrade; ticket: string }
  | { phase: "countdown" | "racing" | "result"; grade: RushGrade; match: string;
      startsAt: number; serverNow: number; you: RivalProgress; opponent: RivalProgress;
      question?: Question; spectating?: { question: Question; draft: string | null }; result?: { outcome: "win" | "loss" | "draw" | "no contest"; reason: ResultReason } };
export type QueueCounts = Record<RushGrade, number>;
export type RivalsAnswer = { state: RivalsState; outcome?: Outcome };

type TimedPlayer = Pick<RivalProgress, "resolved" | "mistakes" | "finishedMs"> & { lastSeen: number };
type Decision = { reason: ResultReason; winner: 0 | 1 | null };

export function effectiveMistakes(player: Pick<RivalProgress, "resolved" | "mistakes">) {
  return player.mistakes + rushLength - player.resolved;
}

function compare(a: TimedPlayer, b: TimedPlayer, deadline: boolean): 0 | 1 | null {
  const errors = deadline ? effectiveMistakes(a) - effectiveMistakes(b) : a.mistakes - b.mistakes;
  const timeA = a.finishedMs ?? Infinity;
  const timeB = b.finishedMs ?? Infinity;
  if (errors !== 0) return errors < 0 ? 0 : 1;
  return timeA === timeB ? null : timeA < timeB ? 0 : 1;
}

export function raceDecision(players: [TimedPlayer, TimedPlayer], start: number, now: number): Decision | null {
  const [a, b] = players;
  if (a.finishedMs !== null && b.finishedMs !== null)
    return { reason: "finished", winner: compare(a, b, false) };
  if (a.finishedMs !== null && a.mistakes <= b.mistakes) return { reason: "finished", winner: 0 };
  if (b.finishedMs !== null && b.mistakes <= a.mistakes) return { reason: "finished", winner: 1 };

  const expiry = (player: TimedPlayer) => player.finishedMs === null ? player.lastSeen + raceLeaseMs : Infinity;
  const aExpiry = expiry(a);
  const bExpiry = expiry(b);
  const deadline = start + raceLimitMs;
  if (Math.min(aExpiry, bExpiry) < deadline && Math.min(aExpiry, bExpiry) <= now) {
    if (Math.max(aExpiry, bExpiry) < deadline && Math.max(aExpiry, bExpiry) <= now)
      return { reason: "abandoned", winner: null };
    return { reason: "forfeit", winner: aExpiry < bExpiry ? 1 : 0 };
  }
  return now >= deadline ? { reason: "deadline", winner: compare(a, b, true) } : null;
}
