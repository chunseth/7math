import assert from "node:assert/strict";
import { test } from "node:test";
import { readCourseBank } from "../lib/mentalist/bank";
import { calculatorDecimal, calculatorResponse, calculatorSettings, evaluateCalculation } from "../lib/mentalist/calculator";

test("calculator uses the stated value of pi for circle areas and preserves answer precision", () => {
  const control = { kind: "decimal", places: 2, width: 4 };
  const settings = calculatorSettings("Use π = 3.14. Find area in cm² for radius 23 cm.", control)!;
  assert.equal(settings.pi, "3.14");
  assert.equal(calculatorResponse(evaluateCalculation("π×23^2", settings.pi), control), "1661.06");
  assert.equal(calculatorSettings("Find the coefficient of π in the base area.", { kind: "whole" }), null);
});

test("calculator handles percentages and powers for compound interest", () => {
  const control = { kind: "decimal", places: 2, width: 4 };
  const settings = calculatorSettings("$1500 earns 2% compounded annually for two years. Find the ending balance.", control)!;
  assert.equal(calculatorResponse(evaluateCalculation("1500×(1+2%)^2", settings.pi), control), "1560.60");
  assert.equal(calculatorDecimal(evaluateCalculation("2000×(1+5%)", settings.pi), 2), "2100.00");
  assert.equal(calculatorDecimal(evaluateCalculation("2000×(1+5%)^2", settings.pi), 2), "2205.00");
});

test("calculator handles factorial, expression precedence and invalid input", () => {
  const solve = (expression: string) => evaluateCalculation(expression, "3.14");
  assert.equal(calculatorDecimal(solve("0! + 5!"), 0), "121");
  assert.equal(calculatorDecimal(solve("-3^2 + 2^3^2"), 0), "503");
  assert.equal(calculatorDecimal(solve("5÷2"), 2), "2.50");
  assert.throws(() => solve("(-1)!"));
  assert.throws(() => solve("10/0"));
  assert.throws(() => solve("2^1.5"));
  assert.throws(() => solve("2π"));
});

test("all current compound-interest and numerical circle-area prompts get the calculator", () => {
  let circle = 0, compound = 0;
  for (const grade of [6, 7, 8] as const) {
    const bank = readCourseBank(grade);
    for (const { pool } of bank.levels) for (const { q } of pool) {
      const { prompt, control } = bank.questions[q];
      if (/π = 3\.14/.test(prompt) && /area/i.test(prompt)) {
        assert.equal(calculatorSettings(prompt, control)?.pi, "3.14", q);
        circle++;
      } else if (/compound(?:ed|ing| interest)/i.test(prompt)) {
        assert.ok(calculatorSettings(prompt, control), q);
        compound++;
      }
    }
  }
  assert.equal(circle, 88);
  assert.equal(compound, 136);
});
