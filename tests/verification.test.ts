import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readCourseBank } from "../lib/mentalist/bank";
import { grade } from "../lib/mentalist/model";
import { checkLocally, type LevelPack } from "../lib/mentalist/round";
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

test("coin simulation keys count the displayed outcomes across varied trials", () => {
  const bank = readCourseBank(7);
  const { pool } = bank.levels.find(level => level.id === "chance.simulate.2")!;
  const counts = new Set();
  for (const { q: id } of pool) {
    const question = bank.questions[id];
    const outcomes = question.visual?.outcomes ?? [];
    assert.equal(outcomes.length, 8, id);
    const heads = outcomes.filter(outcome => outcome === "H").length;
    assert.equal(question.answer, `${heads}|${8 - heads}`, id);
    counts.add(heads);
  }
  assert.ok(counts.size >= 4);
});
