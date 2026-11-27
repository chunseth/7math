import assert from "node:assert/strict";
import { test } from "node:test";
import { readCourseBank } from "../lib/mentalist/bank";
import { checkLocally } from "../lib/mentalist/round";
import { drawRush } from "../lib/rush/bank";
import { rushGrade, rushGrades, rushLength } from "../lib/rush/model";

test("each Rush grade draws 12 distinct questions from its own bank", async () => {
  for (const grade of rushGrades) {
    const bank = readCourseBank(grade);
    const questions = new Set(Object.values(bank.questions));
    const { pack, selected } = drawRush(grade);
    assert.equal(pack.questions.length, rushLength);
    assert.equal(new Set(selected.map(q => JSON.stringify([q.prompt, q.visual, q.control]))).size, rushLength);
    for (const [index, question] of selected.entries()) {
      assert.ok(questions.has(question));
      assert.ok(!("answer" in pack.questions[index]));
      const answer = question.control.kind === "fraction" && !question.answer.includes("/")
        ? question.answer + "/1" : question.answer;
      assert.equal(await checkLocally(pack, index, answer), "correct");
    }
  }
});

test("Rush accepts only the three supported grade values", () => {
  for (const grade of rushGrades) {
    assert.equal(rushGrade(grade), grade);
    assert.equal(rushGrade(String(grade)), grade);
  }
  for (const value of [undefined, null, [], {}, 9, "07", "7.0", ""])
    assert.equal(rushGrade(value), undefined);
});
