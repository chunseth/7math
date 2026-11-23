import { randomInt, randomUUID } from "node:crypto";
import { readCourseBank, type BankQuestion } from "../mentalist/bank";
import { hash } from "../mentalist/db";
import { checkText, type LevelPack } from "../mentalist/round";
import { rushLength } from "./model";

let pool: BankQuestion[] | undefined;
function questions() {
  pool ??= ([6, 7, 8] as const).flatMap(grade => Object.values(readCourseBank(grade).questions));
  return pool;
}

export function drawRush() {
  const bank = questions();
  const selected: BankQuestion[] = [];
  const seen = new Set<string>();
  while (selected.length < rushLength) {
    const question = bank[randomInt(bank.length)];
    const key = JSON.stringify([question.prompt, question.visual, question.control]);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(question);
  }
  const set = randomUUID();
  const pack: LevelPack = {
    level: "rush",
    set,
    questions: selected.map((question, index) => ({
      prompt: question.prompt,
      control: question.control,
      visual: question.visual,
      check: hash(checkText(set, index, question, question.answer)),
    })),
  };
  return { pack, selected };
}
