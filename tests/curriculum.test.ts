import { test } from "node:test";
import assert from "node:assert/strict";
import { concepts, conceptById, validateCatalog } from "../lib/curriculum/catalog";
import { parseAnswer, equal, rational, calculate, formatRational } from "../lib/curriculum/rational";
import { makeNumericProblem, numericConceptIds } from "../lib/curriculum/templates";

test("catalog is a connected-reference DAG with the complete core expectation set", () => {
  assert.doesNotThrow(validateCatalog);
  assert.equal(concepts.length,69);
  assert.equal(concepts.filter((n) => n.scope === "review").length,15);
  const expected = new Set(["7.2","7.7"]);
  for (const [section,letters] of Object.entries({3:"AB",4:"ABCDE",5:"ABC",6:"ABCDEFGHI",8:"ABC",9:"ABCD",10:"ABC",11:"ABC",12:"ABC",13:"ABCDEF"})) {
    for (const letter of letters) expected.add(`7.${section}${letter}`);
  }
  assert.deepEqual(new Set(concepts.flatMap((n) => n.teks)),expected);
  numericConceptIds.forEach((id) => assert.ok(conceptById.has(id)));
});

test("fraction, decimal, and mixed-number responses use exact signed equality", () => {
  for (const raw of ["3/4","6/8","0.75",".750","+0.75","-3/-4"]) assert.ok(equal(parseAnswer(raw)!,rational(3,4)),raw);
  for (const raw of ["−1 1/2","-1.5","-3/2","3/-2"]) assert.ok(equal(parseAnswer(raw)!,rational(-3,2)),raw);
  assert.ok(equal(parseAnswer("0")!,rational(0)));
  assert.ok(equal(parseAnswer("-0.000")!,rational(0)));
  assert.ok(equal(parseAnswer("0.1")!,calculate(rational(3,10),rational(2,10),"subtract")));
  assert.equal(formatRational(parseAnswer("2/4")!),"1/2");
});

test("invalid and incomplete answers cannot be graded as zero", () => {
  for (const raw of ["", " ", "-", ".", "1/0", "0/0", "1/", "1//2", "1.2.3", "NaN", "Infinity", "1e2", "0x10", "1+2", "2 3/2", "2 1/0", "1".repeat(70)]) {
    assert.equal(parseAnswer(raw),null,raw);
  }
  assert.throws(() => rational(1,0));
  assert.throws(() => calculate(rational(1),rational(0),"divide"));
});

test("integer and percent fixtures have correct mathematical answers", () => {
  assert.ok(equal(makeNumericProblem("number.integer-add",0,()=>0).answer,rational(-2)));
  assert.ok(equal(makeNumericProblem("number.integer-add",1,()=>0).answer,rational(-2)));
  assert.ok(equal(makeNumericProblem("number.integer-multiply",1,()=>0).answer,rational(-1)));
  const percentAnswers = [2,20,10];
  percentAnswers.forEach((answer,index) => assert.ok(equal(makeNumericProblem("percent.parts",index,()=>0).answer,rational(answer))));
  assert.ok(equal(makeNumericProblem("algebra.equation",0,()=>0).answer,rational(-12)));
  assert.throws(() => makeNumericProblem("number.sets",0));
});

test("all pilot operations remain valid at operand bounds and rotate variants", () => {
  for (const id of numericConceptIds) {
    const variants = new Set<string>();
    for (let sequence=0;sequence<24;sequence++) {
      for (const rng of [()=>0,()=>0.999999]) {
        const problem = makeNumericProblem(id,sequence,rng);
        assert.equal(problem.conceptId,id);
        assert.ok(problem.answer.denominator>BigInt(0));
        assert.ok(equal(parseAnswer(formatRational(problem.answer))!,problem.answer));
        variants.add(problem.variant);
      }
    }
    assert.equal(variants.size,id === "algebra.equation" ? 1 : id === "percent.parts" ? 3 : id.startsWith("number.integer") ? 2 : 4);
  }
});
