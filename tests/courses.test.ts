import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import { accessMap, courses, evaluate, fieldAttempt, grade, gradeOf, gradeQuestion, hasSequentialFields, levels, type Question, type Recorded } from "../lib/mentalist/model";
import { checkField, checkLocally, checkText, guestOrder, type LevelPack } from "../lib/mentalist/round";
import { leastOrder, leastOrderAttempt, studentPrompt } from "../lib/mentalist/least-order";
import { responseUnit } from "../lib/mentalist/units";

type Bank = {
  version: number;
  levels: { id: string; pool: { q: string; evidence?: string }[] }[];
  questions: Record<string, Question & { answer: string }>;
};
const specs = {
  6: { count: 222, skills: 92, version: 6005, opening: "g6.foundation-sums.1", singleton: "6.11", strands: {2:"E",3:"E",4:"H",5:"C",6:"C",7:"D",8:"D",9:"C",10:"B",12:"D",13:"B",14:"H"} },
  8: { count: 225, skills: 101, version: 8005, opening: "g8.foundation-numbers.1", singleton: "8.9", strands: {2:"D",3:"C",4:"C",5:"I",6:"C",7:"D",8:"D",10:"D",11:"C",12:"G"} },
};

for (const number of [6, 8] as const) {
  const course = courses[number];
  const dir = number + "math";
  const spec = specs[number];
  test(`Grade ${number} map includes each content standard, prerequisite and worked example`, () => {
    const videos = JSON.parse(readFileSync(`content/${dir}/previews.json`, "utf8")) as
      { level: string; media?: string; mediaCourse?: string; steps: unknown[]; answer: string }[];
    const prior = new Set<string>(), standards = new Set<string>();
    assert.equal(videos.length, spec.count);
    for (const lesson of course.skills) {
      assert.equal(gradeOf(lesson.id), number);
      assert.ok(lesson.prerequisites.every(id => prior.has(id)), lesson.id);
      assert.ok(!prior.has(lesson.id));
      prior.add(lesson.id);
      lesson.standards.forEach(code => standards.add(code));
      for (let i=0; i<lesson.levels.length; i++) {
        const level = lesson.id + "." + (i+1);
        const clip = videos.find(c => c.level === level);
        assert.ok(clip && clip.steps.length === 2 && clip.answer, level);
        for (const ext of ["mp4", "webp"])
          assert.ok(existsSync(`public/${clip.mediaCourse ?? dir}/previews/${clip.media ?? level}.${ext}`), level);
      }
    }
    for (const [strand, last] of Object.entries(spec.strands))
      for (let code = 65; code <= last.charCodeAt(0); code++)
        assert.ok(standards.has(number + "." + strand + String.fromCharCode(code)));
    assert.ok(standards.has(spec.singleton));
    assert.equal(prior.size, spec.skills);
    const published = new Set(course.levels.map(l => l.id));
    const access = accessMap(published, [], new Set(), new Set(), new Set(), course.levels);
    assert.equal(access.find(l => l.id === spec.opening)?.state, "ready");
    assert.equal(access.find(l => l.id === `g${number}.college.1`)?.state, "locked");
    assert.ok([...levels, ...courses[number === 6 ? 8 : 6].levels].every(l => !published.has(l.id)));
  });

  test(`Grade ${number} practice packs contain 24 distinct questions with matching client and server keys per lesson`, async () => {
    const bank: Bank = JSON.parse(gunzipSync(readFileSync(`content/${dir}/bank.json.gz`)).toString());
    assert.equal(bank.version, spec.version);
    assert.deepEqual(bank.levels.map(l => l.id), course.levels.map(l => l.id));
    for (const level of bank.levels) {
      const pack: LevelPack = JSON.parse(readFileSync(`public/${dir}/practice/${level.id}.json`, "utf8"));
      assert.equal(pack.questions.length, 24);
      assert.equal(new Set(level.pool.map(p => p.q)).size, 24);
      assert.equal(new Set(pack.questions.map(q => JSON.stringify([q.prompt, q.visual]))).size, 24);
      for (const [i, slot] of level.pool.entries()) {
        const q = bank.questions[slot.q];
        const raw = q.control.kind === "fraction" && !q.answer.includes("/") ? q.answer + "/1" : q.answer;
        assert.equal(pack.questions[i].prompt, q.prompt);
        assert.ok(!("answer" in pack.questions[i]));
        assert.equal(grade(q.control, q.answer, raw)?.outcome, "correct", slot.q);
        assert.equal(await checkLocally(pack, i, raw), "correct", slot.q);
        if (hasSequentialFields(q.control)) for (const [part, value] of q.answer.split("|").entries()) {
          const candidate = pack.questions[i];
          assert.equal(await checkField(candidate, part, value), true, slot.q);
          assert.equal(gradeQuestion(q, q.answer, fieldAttempt(part, value)), null);
          const wrong = q.control.fields?.[part].options.find(option => option !== value);
          if (wrong !== undefined && !await checkField(candidate, part, wrong)) {
            const failedPart = fieldAttempt(part, wrong);
            assert.equal(gradeQuestion(q, q.answer, failedPart)?.outcome, "incorrect", slot.q);
            assert.equal(await checkLocally(pack, i, failedPart), "incorrect", slot.q);
          }
        }
      }
    }
  });
}

test("number bubbles score a wrong tap immediately and require all three correct taps", async () => {
  for (const [path, level] of [
    ["content/6math/bank.json.gz", "g6.steps-order.2"],
    ["content/mentalist/bank-v6.json.gz", "review.numberline.2"],
  ]) {
    const bank: Bank = JSON.parse(gunzipSync(readFileSync(path)).toString());
    const { pool } = bank.levels.find(item => item.id === level)!;
    const set = "number-bubbles";
    const pack: LevelPack = path.includes("/6math/")
      ? JSON.parse(readFileSync(`public/6math/practice/${level}.json`, "utf8"))
      : { level, set, questions: pool.map(({ q }, i) => {
        const { answer, ...question } = bank.questions[q];
        return { ...question, check: createHash("sha256").update(checkText(set, i, question, answer)).digest("hex") };
      }) };
    let bubbleQuestions = 0;
    for (const [i, slot] of pool.entries()) {
      const { answer, ...question } = bank.questions[slot.q];
      if (!question.prompt.startsWith("Which is least:")) {
        assert.equal(studentPrompt(question), question.prompt);
        continue;
      }
      bubbleQuestions++;
      const order = leastOrder(question);
      assert.ok(order, slot.q);
      const [least, middle, greatest] = order;
      assert.ok(Number(least) < Number(middle) && Number(middle) < Number(greatest));
      assert.equal(least, answer);
      assert.match(studentPrompt(question), /least to greatest/);
      for (const [picks, outcome] of [
        [order, "correct"], [[middle], "incorrect"], [[greatest], "incorrect"], [[least, greatest], "incorrect"],
      ] as const) {
        const raw = leastOrderAttempt([...picks]);
        assert.equal(gradeQuestion(question, answer, raw)?.outcome, outcome);
        assert.equal(await checkLocally(pack, i, raw), outcome);
      }
      for (const picks of [[least], [least, middle], [least, least], [middle, greatest]]) {
        const raw = leastOrderAttempt(picks);
        assert.equal(gradeQuestion(question, answer, raw), null);
        await assert.rejects(checkLocally(pack, i, raw), /Finish your answer/);
      }
      assert.equal(gradeQuestion(question, answer, least)?.outcome, "correct");
    }
    assert.equal(bubbleQuestions, 15);
  }
});

test("numeric answer units describe the requested quantity", () => {
  for (const [prompt, expected] of [
    ["At 6 km/h for 3 hours, find distance in km.", "km"],
    ["Traveling 18 km in 3 hours, find km/h.", "km/h"],
    ["Convert 9.5 meters to centimeters.", "cm"],
    ["A circle has radius 5 m. Use π = 3.14. Find its area.", "m²"],
    ["A rectangular prism has volume 4320 cm³. Find one-third of its volume.", "cm³"],
    ["A loan is repaid in 12 monthly payments of $15. Find total repayment.", "dollars"],
    ["A price changes from $1600 to $2240. Find the size of the percent change.", "%"],
    ["How much narrower is the second range, in percentage points?", "percentage points"],
    ["An image changes a 80 cm side to 16 cm. Find its scale factor.", undefined],
  ] as const) {
    assert.equal(responseUnit({ prompt, control: { kind: "whole" } }), expected, prompt);
  }
});

for (const number of [6, 8] as const) test(`Grade ${number} progression preserves earned clears and unlocks each focused level in order`, () => {
  const prefix = "g" + number + ".";
  const child = number === 6 ? "opposites" : "powers";
  const path = courses[number].levels;
  const all = new Set(path.map(l => l.id));
  const old = new Set(courses[number].skills.filter(s => s.previousPrerequisites).map(s => s.id + ".1"));
  assert.equal(old.size, number === 6 ? 43 : 48);
  const states = (published: Set<string>, ids: string[]) =>
    new Map(accessMap(published, ids.map(level => ({level, stars: 3, review_due: ""})), new Set(), new Set(), new Set(), path).map(l => [l.id, l]));
  assert.equal(states(old, []).get(prefix+"sets.1")?.state, "ready");
  assert.equal(states(old, [prefix+"sets.1"]).get(prefix+child+".1")?.state, "ready");
  const mixed = states(all, [prefix+"sets.1"]);
  assert.equal(mixed.get(prefix+"sets.1")?.stars, 3);
  assert.equal(mixed.get(prefix+"steps-"+child+".1")?.state, "ready");
  assert.equal(mixed.get(prefix+"steps-sets.2")?.state, "locked");
  assert.equal(states(all, [prefix+"steps-sets.1"]).get(prefix+"steps-sets.2")?.state, "ready");
  const stages = courses[number].skills.find(s => s.id === prefix+"steps-sets")!.levels;
  assert.equal(states(all, stages.map((_,i) => prefix+"steps-sets."+(i+1))).get(prefix+"sets.1")?.state, "ready");
  const cleared: string[] = [];
  for (const level of path) {
    assert.equal(states(all, cleared).get(level.id)?.state, "ready", level.id);
    cleared.push(level.id);
  }
});

test("the shared rectangular-prism nets have opposite matching faces and linear choices fit every row uniquely", () => {
  const sources = ["content/6math/bank.json.gz", "content/mentalist/bank-v6.json.gz", "content/8math/bank.json.gz"];
  let nets = 0, linear = 0;
  for (const source of sources) {
    const bank: Bank = JSON.parse(gunzipSync(readFileSync(source)).toString());
    for (const q of Object.values(bank.questions)) {
      if (q.visual?.kind === "net" && q.visual.solid === 1) {
        const [first, second, a, b, c, d] = q.visual.values!;
        assert.deepEqual([first, a, b], [second, c, d], q.prompt);
        nets++;
      }
      if (!q.prompt.startsWith("Which equation fits every row of the table?")) continue;
      const rows = q.visual?.rows;
      assert.ok(rows?.length);
      const fits = q.control.options?.filter(option => {
        const [, m, sign, b] = /^y = (\d+)x(?: ([+−]) (\d+))?$/.exec(option)!;
        const start = (sign === "−" ? -1 : 1) * Number(b ?? 0);
        return rows.every(([x, y]) => Number(m) * Number(x) + start === Number(y));
      });
      assert.deepEqual(fits, [q.answer], q.prompt);
      linear++;
    }
  }
  assert.ok(nets >= 104);
  assert.equal(linear, 76);
});

test("sample-spread questions use feasible counts and score the difference in spread", () => {
  const bank: Bank = JSON.parse(gunzipSync(readFileSync("content/8math/bank.json.gz")).toString());
  const level = bank.levels.find(l => l.id === "g8.steps-sampling.3")!;
  for (const {q: id} of level.pool) {
    const q = bank.questions[id];
    const [, lowerSmall, upperSmall, lowerLarge, upperLarge] =
      /^With samples of 10, estimates span (\d+)%–(\d+)%. With samples of 50, they span (\d+)%–(\d+)%/.exec(q.prompt)!.map(Number);
    assert.ok(lowerSmall >= 0 && upperSmall <= 100 && lowerSmall <= upperSmall);
    assert.ok(lowerLarge >= 0 && upperLarge <= 100 && lowerLarge <= upperLarge);
    assert.deepEqual([lowerSmall % 10, upperSmall % 10, lowerLarge % 2, upperLarge % 2], [0,0,0,0]);
    assert.notEqual(lowerLarge - lowerSmall, upperSmall - upperLarge);
    assert.equal(Number(q.answer), (upperSmall - lowerSmall) - (upperLarge - lowerLarge));
  }
});

test("scatterplots accept point order independently and tenth lines grade the marked location", async () => {
  for (const level of ["g8.scatter.1", "g8.estimate.1"]) {
    const pack: LevelPack = JSON.parse(readFileSync(`public/8math/practice/${level}.json`, "utf8"));
    for (let draw = 0; draw < 8; draw++) {
      const order = guestOrder(pack);
      assert.equal(new Set(order).size, 24);
      const counts = [order.slice(0, 12), order.slice(12)].map(indices => indices.filter(i =>
        pack.questions[i].control.kind === (level.includes("scatter") ? "scatterplot" : "line")).length);
      assert.deepEqual(counts, level.includes("scatter") ? [4, 4] : [8, 8]);
    }
  }

  const bank: Bank = JSON.parse(gunzipSync(readFileSync("content/8math/bank.json.gz")).toString());
  for (const level of ["g8.scatter.1", "g8.estimate.1"]) {
    const pack: LevelPack = JSON.parse(readFileSync(`public/8math/practice/${level}.json`, "utf8"));
    const pool = bank.levels.find(l => l.id === level)!.pool;
    for (const [i, slot] of pool.entries()) {
      const q = bank.questions[slot.q];
      if (q.control.kind === "scatterplot") {
        const coordinates = q.visual!.rows!.map(row => row.join(","));
        const reverse = coordinates.reverse().join(";");
        assert.equal(grade(q.control, q.answer, reverse)?.outcome, "correct");
        assert.equal(await checkLocally(pack, i, reverse), "correct");
      }
      if (q.control.kind === "line") {
        const number = Number(q.prompt.match(/(?:√|Mark )(\d+)/)![1]);
        const expected = Math.round((q.prompt.includes("π") ? number * Math.PI : Math.sqrt(number)) * 10) / 10;
        assert.equal(Number(q.answer.split(",")[0]), expected);
        assert.equal(grade(q.control, q.answer, `${expected + 3},0`), null);
      }
    }
  }
});

test("a clear requires first-try evidence of each specified skill", () => {
  const responses: Recorded[][] = Array.from({length: 12}, () => [{outcome: "correct", active_ms: 500}]);
  responses[1].unshift({outcome: "incorrect", active_ms: 500});
  responses[5].unshift({outcome: "incorrect", active_ms: 500});
  const evidence = responses.map((_, i) => i === 1 || i === 5 ? "construct a scatterplot" : undefined);
  assert.equal(evaluate(responses, 10000)?.passed, true);
  assert.equal(evaluate(responses, 10000, evidence)?.passed, false);
  assert.deepEqual(evaluate(responses, 10000, evidence)?.missingEvidence, ["construct a scatterplot"]);
  evidence[9] = "construct a scatterplot";
  assert.equal(evaluate(responses, 10000, evidence)?.passed, true);
});
