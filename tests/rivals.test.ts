import assert from "node:assert/strict";
import test from "node:test";
import { effectiveMistakes, raceDecision, raceLeaseMs, raceLimitMs } from "../lib/rivals/model";

const start = 10_000;
const active = (resolved = 0, mistakes = 0, lastSeen = start) => ({ resolved, mistakes, lastSeen, finishedMs: null });
const finished = (mistakes: number, finishedMs: number) => ({ ...active(12, mistakes), finishedMs });

test("Rivals awards accuracy first and uses time for equally accurate finishes", () => {
  assert.deepEqual(raceDecision([finished(1, 100), finished(0, 200)], start, start + 200),
    { reason: "finished", winner: 1 });
  assert.deepEqual(raceDecision([finished(1, 100), finished(1, 200)], start, start + 200),
    { reason: "finished", winner: 0 });
  assert.deepEqual(raceDecision([finished(1, 100), finished(1, 100)], start, start + 100),
    { reason: "finished", winner: null });
});

test("Rivals waits for the second finisher and expires only unfinished players", () => {
  const first = finished(2, 30);
  assert.equal(raceDecision([first, active()], start, start + raceLeaseMs - 1), null);
  assert.deepEqual(raceDecision([active(), first], start, start + raceLeaseMs), { reason: "forfeit", winner: 1 });
  assert.deepEqual(raceDecision([active(), active()], start, start + raceLeaseMs), { reason: "abandoned", winner: null });
});

test("Rivals counts unanswered questions at the deadline and prefers completed runs on equal totals", () => {
  const deadline = start + raceLimitMs;
  const incomplete = active(9, 1, deadline - 1);
  assert.equal(effectiveMistakes(incomplete), 4);
  assert.deepEqual(raceDecision([incomplete, finished(5, 50)], start, deadline), { reason: "deadline", winner: 0 });
  assert.deepEqual(raceDecision([incomplete, finished(4, 50)], start, deadline), { reason: "deadline", winner: 1 });
  assert.deepEqual(raceDecision([active(9, 0, deadline), finished(0, 50)], start, deadline),
    { reason: "finished", winner: 1 });
  assert.deepEqual(raceDecision([incomplete, active(8, 0, deadline)], start, deadline),
    { reason: "deadline", winner: null });
});

test("Rivals ends as soon as a finisher cannot be beaten on mistakes", () => {
  assert.deepEqual(raceDecision([finished(0, 80), active(1, 0)], start, start + 80),
    { reason: "finished", winner: 0 });
  assert.equal(raceDecision([finished(2, 80), active(5, 1)], start, start + 80), null);
  assert.deepEqual(raceDecision([active(6, 2), finished(2, 80)], start, start + 100),
    { reason: "finished", winner: 1 });
});
