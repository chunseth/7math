import { calculate, formatRational, rational, type Rational } from "./rational";

export type NumericProblem = { templateId: string; templateVersion: 1; conceptId: string; variant: string; prompt: string; answer: Rational; hint: string };
export const numericConceptIds = ["number.integer-add", "number.integer-multiply", "number.decimal", "number.fraction", "percent.parts", "algebra.equation"] as const;
export function isPlayable(id: string) { return numericConceptIds.some((candidate) => candidate === id); }
const ops = ["add", "subtract", "multiply", "divide"] as const;
const symbols = { add: "+", subtract: "−", multiply: "×", divide: "÷" };

/** Sequence rotates variants; RNG controls bounded operands only. All denominators are nonzero. */
export function makeNumericProblem(conceptId: string, sequence: number, rng = Math.random): NumericProblem {
  if (!isPlayable(conceptId)) throw new Error("This concept does not have playable templates yet.");
  const pick = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const op = ops[sequence % ops.length];
  const base = { templateId: `${conceptId}.numeric`, templateVersion: 1 as const, conceptId };
  if (conceptId === "percent.parts") {
    const percent = [10,20,25,50,75][pick(0,4)], whole = pick(1,20)*20;
    const part = whole*percent/100;
    const variant = sequence%3;
    return { ...base, variant: ["find-part","find-whole","find-percent"][variant],
      prompt: variant === 0 ? `What is ${percent}% of ${whole}?` : variant === 1 ? `${part} is ${percent}% of what number?` : `${part} is what percent of ${whole}? Enter the percent number.`,
      answer: rational([part,whole,percent][variant]), hint: "part = whole × (percent ÷ 100). Identify the missing quantity." };
  }
  if (conceptId === "algebra.equation") {
    const x = pick(-12,12), a = pick(2,9) * (sequence%2 ? -1 : 1), b = pick(-15,15);
    return { ...base, variant: "integer-coefficients", prompt: `Solve for x: ${a}x ${b < 0 ? "−" : "+"} ${Math.abs(b)} = ${a*x+b}`,
      answer: rational(x), hint: "Undo the constant term, then divide both sides by the coefficient of x." };
  }
  const operation = conceptId === "number.integer-add" ? ops[sequence%2] : conceptId === "number.integer-multiply" ? ops[2+sequence%2] : op;
  let a: Rational, b: Rational;
  if (conceptId === "number.fraction") {
    a = rational(pick(1,11) * (sequence%2 ? -1 : 1), pick(2,12));
    b = rational(pick(1,11) * (sequence%3 ? 1 : -1), pick(2,12));
  } else if (conceptId === "number.decimal") {
    // Division uses terminating results; other operations exercise tenths and hundredths.
    a = rational(pick(1,99) * (sequence%2 ? -1 : 1), 10);
    b = rational(pick(1,9), operation === "divide" ? 10 : 100);
    if (operation === "divide") a = calculate(b, rational(pick(-20,20),10), "multiply");
  } else {
    a = rational(pick(1,12) * (sequence%4 < 2 ? -1 : 1));
    b = rational(pick(1,12) * (sequence%3 ? 1 : -1));
    if (operation === "divide") a = calculate(a,b,"multiply");
  }
  const display = (n: Rational) => conceptId === "number.decimal" ? String(Number(n.numerator)/Number(n.denominator)) : formatRational(n);
  return { ...base, variant: operation, prompt: `${display(a)} ${symbols[operation]} (${display(b)}) = ?`, answer: calculate(a,b,operation),
    hint: operation === "divide" ? "Divide by multiplying by the reciprocal. Check the signs." : "Keep track of signs. For fraction addition or subtraction, use a common denominator." };
}
