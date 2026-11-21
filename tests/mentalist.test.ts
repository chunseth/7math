import { test } from "node:test";
import assert from "node:assert/strict";
import { accessMap, complete, evaluate, grade, levels, skills, type Recorded } from "../lib/mentalist/model";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
type Bank = {
  sets: { level: string; positions: { q: string; variant: string; target: number }[] }[];
  questions: Record<string, { control: Parameters<typeof grade>[0]; answer: string }>;
};
const bank: Bank = JSON.parse(gunzipSync(readFileSync("content/mentalist/bank-v1.json.gz")).toString());
test("all 250 levels have five distinct ordered sets, identical variant quotas and gradeable keys", () => {
  assert.equal(skills.filter((s) => s.world !== "review").length, 62);
  assert.equal(skills.length, 100);
  assert.equal(levels.length, 250);
  assert.equal(bank.sets.length, 1250);
  for (const l of levels) {
    const sets = bank.sets.filter((s) => s.level === l.id);
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
  p[0].unshift({ outcome: "simplification", active_ms: 900 });
  assert.equal(evaluate(p, 12000)?.firstTry, 12);
  for (const idx of [0, 1]) p[idx].unshift({ outcome: "incorrect", active_ms: 100 });
  p[3][0].active_ms = null;
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
test("assignment and placement grant access without manufacturing cleared levels", () => {
  const ids = new Set(levels.map((l) => l.id)),
    empty = new Set<string>();
  const access = (assigned: Set<string>, placed: Set<string>) => accessMap(ids, [], empty, assigned, placed);
  const base = access(empty, empty);
  assert.equal(base.find((a) => a.id === "decimal.add.1")?.state, "locked");
  assert.equal(base.find((a) => a.id === "signed.add.1")?.state, "ready");
  assert.equal(base.find((a) => a.id === "review.multiply.9.1")?.state, "ready");
  const override = access(new Set(["decimal.add"]), empty);
  assert.equal(override.find((a) => a.id === "decimal.add.1")?.reason, "Teacher assignment");
  assert.equal(override.find((a) => a.id === "decimal.add.2")?.state, "locked");
  const placed = access(
    empty,
    new Set(["signed.add", "signed.subtract", "signed.multiply", "signed.divide"]),
  );
  assert.equal(placed.find((a) => a.id === "signed.add.1")?.state, "placed");
  assert.equal(placed.find((a) => a.id === "decimal.add.1")?.state, "ready");
  ids.delete("signed.add.1");
  assert.equal(access(empty, empty).find((a) => a.id === "signed.add.1")?.state, "planned");
});
