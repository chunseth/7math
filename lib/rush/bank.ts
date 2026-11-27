import { createHash, randomInt, randomUUID } from "node:crypto";
import { publicQuestion, readCourseBank, type BankQuestion } from "../mentalist/bank";
import { checkText, type LevelPack } from "../mentalist/round";
import { rushLength, type RushGrade } from "./model";

const pools = new Map<RushGrade, BankQuestion[]>();
function questions(grade: RushGrade) {
  const cached = pools.get(grade);
  if (cached) return cached;
  const unique = new Map<string, BankQuestion>();
  for (const question of Object.values(readCourseBank(grade).questions)) {
    const key = JSON.stringify([question.prompt, question.visual, question.control]);
    if (!unique.has(key)) unique.set(key, question);
  }
  const pool = [...unique.values()];
  pools.set(grade, pool);
  return pool;
}

export function drawRush(grade: RushGrade) {
  const bank = questions(grade);
  if (bank.length < rushLength) throw Error(`Grade ${grade} needs at least ${rushLength} distinct Rush questions.`);
  const indexes = new Set<number>();
  while (indexes.size < rushLength) indexes.add(randomInt(bank.length));
  const selected = [...indexes].map(index => bank[index]);
  const set = randomUUID();
  const pack: LevelPack = {
    level: "rush",
    set,
    questions: selected.map((question, index) => ({
      ...publicQuestion(question),
      check: createHash("sha256").update(checkText(set, index, question, question.answer)).digest("hex"),
    })),
  };
  return { pack, selected };
}
