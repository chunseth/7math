import { test } from "node:test";
import assert from "node:assert/strict";
import { readCourseBank } from "../lib/mentalist/bank";
import { grade } from "../lib/mentalist/model";
import { verificationCatalog } from "../lib/verification/catalog";
import { countReviews, reviewCases, verificationGrades, type ReviewDecision } from "../lib/verification/model";

for (const course of verificationGrades) test(`Grade ${course} verification samples every student response format`, () => {
  const bank = readCourseBank(course);
  const { world, keys } = verificationCatalog(course);
  const examples = reviewCases(world);
  assert.equal(world.version, bank.version);
  assert.ok(examples.length > 30);
  assert.equal(keys.size, examples.length);
  const counts = new Map<string, number>();
  for (const item of examples) {
    const source = bank.questions[item.questionId];
    assert.ok(bank.levels.find(level => level.id === item.level)?.pool.some(slot => slot.q === item.questionId));
    assert.equal(item.question.prompt, source.prompt);
    assert.deepEqual(item.question.control, source.control);
    assert.deepEqual(item.question.visual, source.visual);
    assert.equal("answer" in item.question, false);
    assert.ok(item.note.length > 40);
    const { answer, control } = source;
    const raw = control.kind === "fraction" && !answer.includes("/") ? answer + "/1" : answer;
    assert.equal(grade(item.question.control, answer, raw)?.outcome, "correct", item.id);
    counts.set(control.kind, (counts.get(control.kind) ?? 0) + 1);
  }
  for (const kind of new Set(Object.values(bank.questions).map(question => question.control.kind))) {
    assert.ok((counts.get(kind) ?? 0) >= 3, `${kind} requires at least three representative examples`);
  }
});

test("review progress counts flagged and accepted separately and stays within its world", () => {
  const [six, seven] = ([6, 7] as const).map(course => verificationCatalog(course).world);
  const [first, second] = reviewCases(six);
  const decisions: Record<string, ReviewDecision> = {
    [first.id]: { id: first.id, status: "accepted", note: null, savedAt: "2026-11-23" },
    [second.id]: { id: second.id, status: "flagged", note: "Expected an open endpoint.", savedAt: "2026-11-23" },
  };
  assert.deepEqual(countReviews(six, decisions), { total: reviewCases(six).length, accepted: 1, flagged: 1 });
  assert.deepEqual(countReviews(seven, decisions), { total: reviewCases(seven).length, accepted: 0, flagged: 0 });
});
