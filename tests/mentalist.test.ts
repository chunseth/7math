import { test } from "node:test";
import assert from "node:assert/strict";
import { accessMap, cardTopic, currentLevel, complete, evaluate, grade, levels, mainPathLevels, lessonStops, mainPathProgress, skills, type Recorded } from "../lib/mentalist/model";
import { previewGoal, sideGoals } from "../lib/mentalist/preview-goals";
import previews from "../content/mentalist/previews.json";
import { existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
type Slot = { q: string; variant: string; target: number };
type Bank = {
  levels: { id: string; pool: Slot[] }[];
  sets: { level: string; positions: Slot[] }[];
  questions: Record<string, { prompt: string; visual?: unknown; control: Parameters<typeof grade>[0]; answer: string }>;
};
const bank: Bank = JSON.parse(gunzipSync(readFileSync("content/mentalist/bank-v5.json.gz")).toString());
test("all 237 levels have 24 distinct gradeable questions and five balanced round blueprints", () => {
  assert.equal(skills.filter((s) => s.world !== "review").length, 62);
  assert.equal(skills.length, 87);
  assert.equal(levels.length, 237);
  assert.equal(bank.sets.length, 1185);
  for (const l of levels) {
    const pool = bank.levels.find(level => level.id === l.id)!.pool;
    assert.equal(pool.length, 24, l.id);
    assert.equal(new Set(pool.map(slot => slot.q)).size, 24, l.id);
    const surfaces = pool.map(({q}) => {
      const question = bank.questions[q];
      return JSON.stringify([question.prompt, question.visual, question.control.fields?.map(f => f.label)]);
    });
    assert.equal(new Set(surfaces).size, 24, l.id);
    const sets = bank.sets.filter((s) => s.level === l.id);
    assert.deepEqual(new Set(sets.flatMap(s => s.positions.map(slot => slot.q))), new Set(pool.map(slot => slot.q)));
    assert.equal(sets.length, 5);
    assert.equal(new Set(sets.map((s) => s.positions.map((p) => p.q).join(","))).size, 5);
    const slots = sets[0].positions.map((p) => p.variant);
    for (const s of sets) {
      assert.equal(s.positions.length, 12);
      assert.deepEqual(
        s.positions.map((p) => p.variant),
        slots,
      );
      assert.equal(new Set(s.positions.map((p) => p.q)).size, 12);
      for (const p of s.positions) {
        const { control, answer } = bank.questions[p.q],
          raw = control.kind === "fraction" && !answer.includes("/") ? answer + "/1" : answer;
        assert.equal(grade(control, answer, raw)?.outcome, "correct", p.q);
      }
    }
  }
});
test("one sampled level per fact group, with zero dividends and shared topic cards", () => {
  const groups = [[0,1], [2,3,4], [5,10], [6,7], [8,9], [11,12]];
  for (const op of ["multiply", "divide"]) {
    const facts = mainPathLevels.filter(l => l.skill.startsWith("review." + op + "."));
    assert.equal(facts.length, 6);
    groups.forEach((group, i) => {
      const level = facts[i];
      for (const set of bank.sets.filter(s => s.level === level.id)) {
        for (const table of group) {
          const items = set.positions.filter(p => p.variant.endsWith(".table-" + table));
          assert.equal(items.length, 12 / group.length);
          for (const {q} of items) {
            if (op === "multiply") assert.ok(q.split(".").slice(2).includes(String(table)));
            else if (table === 0) assert.match(q, /^fact\.divide\.0\.[1-9]\d*$/);
            else assert.ok(q.endsWith("." + table));
          }
        }
      }
      for (const table of group)
        assert.equal(currentLevel(`review.${op}.${table}.1`), level.id);
      assert.equal(cardTopic(level.skill), op === "multiply" ? "multiplication" : "division");
    });
  }
  assert.equal(cardTopic("review.divide.9"), "division");
  assert.equal(cardTopic("review.add"), "review");
  assert.equal(cardTopic("ratio.equivalent"), cardTopic("ratio.unit"));
});
test("first-scored accuracy, revisions, simplifications and fluency thresholds are independent", () => {
  const integer = { kind: "whole", width: 2 },
    fraction = { kind: "fraction", signed: true };
  assert.deepEqual(
    ["54", "62", "63"].map((a) => grade(integer, "63", a)?.outcome),
    ["incorrect", "incorrect", "correct"],
  );
  assert.deepEqual(
    ["2/4", "1/2"].map((a) => grade(fraction, "1/2", a)?.outcome),
    ["simplification", "correct"],
  );
  for (const invalid of ["/2", "1/", "1/0", "", "2/-"]) assert.equal(grade(fraction, "1/2", invalid), null);
  assert.equal(grade(fraction, "-1/2", "1/-2")?.outcome, "simplification");
  assert.equal(grade(fraction, "3/2", "3/2")?.outcome, "correct");
  assert.equal(
    grade({ kind: "decimal", width: 1, places: 2, signed: true }, "-0.25", "-0.25")?.outcome,
    "correct",
  );
  assert.equal(complete({ kind: "decimal", width: 1, places: 2 }, "0.2"), false);
  assert.equal(grade({ kind: "whole", width: 1, signed: true }, "0", "-0")?.outcome, "correct");
  const p: Recorded[][] = Array.from({ length: 12 }, () => [{ outcome: "correct", active_ms: 1000 }]);
  assert.equal(evaluate(p.slice(1), 12000), null);
  assert.equal(evaluate(p, 12000)?.stars, 3);
  assert.equal(evaluate(p, 8000)?.stars, 2);
  assert.equal(evaluate(p, 7999)?.stars, 1);
  assert.equal(evaluate(p, 12000)?.fastestProblemMs, 1000);
  p[0] = [{ outcome: "simplification", active_ms: 250 }, { outcome: "correct", active_ms: 100 }];
  assert.equal(evaluate(p, 12000)?.fastestProblemMs, 350);
  assert.equal(evaluate(p, 12000)?.stars, 3);
  p[0].unshift({ outcome: "incorrect", active_ms: 100 });
  assert.equal(evaluate(p, 12000)?.stars, 2);
  assert.equal(evaluate(p, 7000)?.stars, 1);
  p[0].unshift({ outcome: "incorrect", active_ms: 100 });
  assert.equal(evaluate(p, 12000)?.stars, 1);
  p[0] = [{ outcome: "correct", active_ms: 1000 }];
  p[0].unshift({ outcome: "simplification", active_ms: 900 });
  assert.equal(evaluate(p, 12000)?.firstTry, 12);
  for (const idx of [0, 1]) p[idx].unshift({ outcome: "incorrect", active_ms: 100 });
  p[3][0].active_ms = null;
  assert.equal(evaluate(p, 12000)?.fastestProblemMs, null);
  assert.deepEqual(
    [evaluate(p, 12000)?.firstTry, evaluate(p, 12000)?.stars, evaluate(p, 12000)?.activeMs],
    [10, 1, null],
  );
  p[2].unshift({ outcome: "incorrect", active_ms: 10 });
  const r = evaluate(p, 12000)!;
  assert.equal(r.firstTry, 9);
  assert.equal(r.passed, false);
  assert.equal(r.attemptAccuracy, 12 / 15);
});
test("prerequisites lock assigned skills while placement grants access without clears", () => {
  const ids = new Set(levels.map((l) => l.id)),
    empty = new Set<string>();
  const access = (assigned: Set<string>, placed: Set<string>) => accessMap(ids, [], empty, assigned, placed);
  const base = access(empty, empty);
  assert.equal(base.find((a) => a.id === "decimal.add.1")?.state, "locked");
  assert.equal(base.find((a) => a.id === "signed.add.1")?.state, "locked");
  assert.match(base.find((a) => a.id === "signed.add.1")?.reason ?? "", /Addition|Subtraction/);
  assert.equal(base.find((a) => a.id === "review.add.1")?.state, "ready");
  assert.equal(base.find((a) => a.id === "review.multiply.8-9.1")?.state, "ready");
  assert.deepEqual([mainPathProgress(base).target, mainPathProgress(base).next], ["review.add.1", "review.add.1"]);
  const override = access(new Set(["decimal.add"]), empty);
  assert.equal(override.find((a) => a.id === "decimal.add.1")?.state, "locked");
  assert.equal(override.find((a) => a.id === "decimal.add.2")?.state, "locked");
  assert.equal(access(empty, new Set(["decimal.add"])).find((a) => a.id === "decimal.add.1")?.state, "placed");
  const placed = access(
    empty,
    new Set(["signed.add", "signed.subtract", "signed.multiply", "signed.divide", "review.conversions"]),
  );
  assert.equal(placed.find((a) => a.id === "signed.add.1")?.state, "placed");
  assert.equal(placed.find((a) => a.id === "decimal.add.1")?.state, "ready");
  ids.delete("signed.add.1");
  assert.equal(access(empty, empty).find((a) => a.id === "signed.add.1")?.state, "planned");
});
test("main path follows the lesson plan and keeps the earliest unfinished stop", () => {
  const included = new Set(["review.add", "review.subtract", "signed.add"]);
  const published = new Set(levels.filter((l) => included.has(l.skill)).map((l) => l.id));
  const state = (cleared: string[]) => {
    const access = accessMap(
      published,
      cleared.map((level) => ({ level, stars: 1, review_due: "2099-01-01" })),
      new Set(),
      new Set(),
      new Set(),
    );
    return mainPathProgress(access);
  };
  assert.deepEqual([state([]).target, state([]).next, state([]).total], ["review.add.1", "review.add.1", 9]);
  assert.equal(
    mainPathProgress(accessMap(published, [], new Set(), new Set(), new Set(["review.add"]))).next,
    "review.subtract.1",
  );
  const addition = levels.filter((l) => l.skill === "review.add").map((l) => l.id);
  assert.equal(state(addition).next, "review.subtract.1");
  const subtraction = levels.filter((l) => l.skill === "review.subtract").map((l) => l.id);
  assert.equal(state([...addition, ...subtraction]).next, "signed.add.1");
  assert.equal(state([...addition, ...subtraction, "signed.add.1"]).next, "signed.add.2");
  assert.equal(state([...addition, ...subtraction, "signed.add.1", "signed.add.2", "signed.add.3"]).target, null);
});

test("quick goals count the entire unfinished chain once and follow shared clears and placements", () => {
  const published = new Set(levels.map(l => l.id));
  const access = (done: string[] = [], placed: string[] = []) => accessMap(published,
    done.map(level => ({level, stars: 1, review_due: ""})), new Set(), new Set(), new Set(placed));
  const initial = previewGoal("ratio.unit", access());
  assert.equal(initial.quick, false);
  assert.equal(initial.foundations.includes("review.multiply.8-9"), true);
  assert.equal(initial.foundations.includes("ratio.equivalent"), true);
  const foundations = levels.filter(l => l.skill === "review.fractions").map(l => l.id);
  const quick = previewGoal("ratio.unit", access(foundations));
  assert.equal(quick.quick, true);
  assert.deepEqual(quick.foundations, ["ratio.equivalent"]);
  assert.equal(quick.next, "ratio.equivalent.1");
  assert.equal(quick.remaining, 6);
  assert.equal(previewGoal("ratio.unit", access([], ["ratio.equivalent"])).next, "ratio.unit.1");
  const completed = previewGoal("review.multiply.8-9", access(["review.multiply.8-9.1"]));
  assert.equal(completed.complete, true);
  assert.equal(completed.quick, false);
  const fractions = previewGoal("fraction.add", access());
  assert.equal(fractions.foundations.filter(id => id === "review.add").length, 1);
  published.delete("ratio.unit.2");
  assert.equal(previewGoal("ratio.unit", access(foundations)).quick, false);
});

test("the authored plan and videos cover every existing level once in prerequisite order", () => {
  assert.equal(lessonStops.length, 87);
  assert.deepEqual(lessonStops[4].levels.map(level => level.skill), ["review.multiply.5-10"]);
  const ids = mainPathLevels.map(level => level.id);
  assert.deepEqual([...ids].sort(), levels.map(level => level.id).sort());
  assert.deepEqual(previews.map(clip => clip.level), ids);
  for (const skill of skills) {
    const position = mainPathLevels.findIndex(level => level.skill === skill.id);
    for (const parent of skill.prerequisites)
      assert.ok(mainPathLevels.findIndex(level => level.skill === parent) < position);
  }
  for (const clip of previews) {
    const base = "public/mentalist/previews/" + (clip.media ?? (clip.model === "worked" ? clip.level : clip.skill));
    assert.ok(existsSync(base + ".mp4") && existsSync(base + ".webp"), clip.level);
  }
});
test("side goals include ready skills and single-foundation skills and share clears with the main path", () => {
  const state = (cleared: string[]) => accessMap(new Set(levels.map(l => l.id)),
    cleared.map(level => ({level, stars: 1, review_due: ""})), new Set(), new Set(), new Set());
  const initial = sideGoals(state([]));
  assert.equal(initial.length, new Set(initial.map(item => item.level.skill)).size);
  assert.ok(initial.some(item => item.level.id === "review.add.1" && item.goal.foundations.length === 0));
  assert.ok(!initial.some(item => item.level.skill === "signed.add"));
  const addition = levels.filter(l => l.skill === "review.add").map(l => l.id);
  const cleared = [...addition, "review.multiply.8-9.1", "review.subtract.1"];
  const options = sideGoals(state(cleared));
  assert.ok(!options.some(item => item.level.skill === "review.multiply.8-9"));
  assert.equal(options.find(item => item.level.skill === "signed.add")?.goal.next, "review.subtract.2");
  assert.equal(options.find(item => item.level.skill === "review.subtract")?.level.id, "review.subtract.2");
  assert.equal(mainPathProgress(state(cleared)).next, "review.subtract.2");
});
