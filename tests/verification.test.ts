import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { publicQuestion, readCourseBank } from "../lib/mentalist/bank";
import { coinTrialAttempt, fieldAttempt, grade, gradeQuestion } from "../lib/mentalist/model";
import { checkLocally, type LevelPack } from "../lib/mentalist/round";
import { reviewFormat } from "../lib/verification/formats";
import { verificationCatalog } from "../lib/verification/catalog";
import { countReviews, nextReview, verificationGrades, type ReviewDecision } from "../lib/verification/model";

test("the combined set contains one question per supported presentation and response format", () => {
  const { set, sources } = verificationCatalog();
  const expected = new Set<string>();
  for (const grade of verificationGrades) {
    const bank = readCourseBank(grade);
    for (const level of bank.levels) for (const { q } of level.pool) expected.add(reviewFormat(bank.questions[q]));
  }
  const actual = new Set(set.cases.map(item => reviewFormat(sources.get(item.id)!.question)));
  assert.deepEqual(actual, expected);
  assert.equal(set.cases.length, expected.size);
  assert.match(set.id, /^combined-v1-[a-f0-9]{24}$/);
  assert.deepEqual([...new Set(set.cases.map(item => item.grade))].sort(), [...verificationGrades]);
  assert.ok(set.cases.slice(0, 15).some((item, i) => i && item.grade !== set.cases[i - 1].grade));
  for (const item of set.cases) {
    const bank = readCourseBank(item.grade);
    const question = bank.questions[item.questionId];
    assert.ok(bank.levels.find(level => level.id === item.level)?.pool.some(slot => slot.q === item.questionId));
    assert.equal(item.bankVersion, bank.version);
    assert.deepEqual(item.question, publicQuestion(question));
    for (const hidden of ["answer", "note", "workedExample"]) assert.ok(!(hidden in item.question) && !(hidden in item));
  }
});

test("an unclassified renderer format is an explicit coverage error", () => {
  assert.throws(() => reviewFormat({ prompt: "Example", control: { kind: "unknown" }, answer: "1" }), /Unclassified answer format/);
  assert.throws(() => reviewFormat({ prompt: "Example", control: { kind: "whole" }, visual: { kind: "unknown" }, answer: "1" }), /Unclassified question visual/);
});

test("a skipped question advances the set without becoming accepted or flagged", () => {
  const { set } = verificationCatalog();
  const [first, second, third, fourth] = set.cases;
  const savedAt = "2026-11-26";
  const decisions: Record<string, ReviewDecision> = {
    [first.id]: { id: first.id, status: "skipped", note: null, savedAt },
    [second.id]: { id: second.id, status: "accepted", note: null, savedAt },
    [third.id]: { id: third.id, status: "flagged", note: "The label overlaps the plot.", savedAt },
    historical: { id: "historical", status: "accepted", note: null, savedAt },
  };
  assert.equal(nextReview(set, decisions)?.id, fourth.id);
  assert.deepEqual(countReviews(set, decisions), { total: set.cases.length, accepted: 1, flagged: 1, skipped: 1 });
  const completed = { ...set, cases: [first, second, third] };
  assert.equal(nextReview(completed, decisions), undefined);
});

test("all four scale drawing orientations match the stored answer in the browser and on the server", async () => {
  const bank = readCourseBank(7);
  const { pool } = bank.levels.find(level => level.id === "similar.drawings.3")!;
  for (const { q: id } of pool) {
    const { answer, ...question } = bank.questions[id];
    const [width, height] = answer.split(",").map(Number);
    const check = createHash("sha256").update(JSON.stringify(["drawing", 0, answer])).digest("hex");
    const pack = { set: "drawing", questions: [{ ...question, check }] } as LevelPack;
    for (const [x, y] of [[width, height], [-width, height], [-width, -height], [width, -height]]) {
      const raw = `${x},${y}`;
      assert.equal(grade(question.control, answer, raw)?.outcome, "correct", id);
      assert.equal(await checkLocally(pack, 0, raw), "correct", id);
    }
    assert.equal(grade(question.control, answer, "0,0")?.outcome, "incorrect", id);
  }
});

test("typed table values and rays accept equivalent numbers and score wrong entries", async () => {
  const level = "g6.steps-ratios.3";
  const bank = readCourseBank(6);
  const { pool } = bank.levels.find(l => l.id === level)!;
  const pack: LevelPack = JSON.parse(readFileSync(`public/6math/practice/${level}.json`, "utf8"));
  const { answer, control } = bank.questions[pool[0].q];
  const equivalent = answer.split("|").map(value => `${2 * Number(value)}/2`).join("|");
  assert.equal(grade(control, answer, equivalent)?.outcome, "correct");
  assert.equal(await checkLocally(pack, 0, equivalent), "correct");
  assert.equal(await checkLocally(pack, 0, "0|0"), "incorrect");
  const ray = readCourseBank(7).questions[readCourseBank(7).levels.find(row => row.id === "algebra.graph.2")!.pool[0].q];
  const [bound, endpoint, direction] = ray.answer.split("|");
  assert.equal(grade(ray.control, ray.answer, `${Number(bound).toFixed(1)}|${endpoint}|${direction}`)?.outcome, "correct");
});

test("coin simulation grades the live tosses and rejects incomplete trials", async () => {
  const bank = readCourseBank(7);
  const { pool } = bank.levels.find(level => level.id === "chance.simulate.2")!;
  const counts = new Set();
  for (const { q: id } of pool) {
    const question = bank.questions[id];
    const outcomes = question.visual?.outcomes ?? [];
    assert.equal(outcomes.length, 8, id);
    const heads = outcomes.filter(outcome => outcome === "H").length;
    assert.equal(question.answer, `${heads}|${8 - heads}`, id);
    const pack: LevelPack = { level: "chance.simulate.2", set: "test", questions: [{ ...question, check: "" }] };
    for (const [input, expected] of [
      [coinTrialAttempt("HHHHTHHH", "7|1"), "correct"],
      [coinTrialAttempt("HHHHTHHH", "4|4"), "incorrect"],
      [coinTrialAttempt("HHHHTHHH", fieldAttempt(0, "4")), "incorrect"],
    ] as const) {
      assert.equal(gradeQuestion(question, question.answer, input)?.outcome, expected);
      assert.equal(await checkLocally(pack, 0, input), expected);
    }
    assert.equal(gradeQuestion(question, question.answer, coinTrialAttempt("HT", "1|1")), null);
    counts.add(heads);
  }
  assert.ok(counts.size >= 4);
});
