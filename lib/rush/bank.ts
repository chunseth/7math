import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { hash } from "../mentalist/db";
import type { Question } from "../mentalist/model";
import { checkText, type LevelPack } from "../mentalist/round";
import { rushLength } from "./model";

export type BankQuestion = Question & { answer: string };

const bankFiles = [
  "content/6math/bank.json.gz",
  "content/mentalist/bank-v4.json.gz",
  "content/8math/bank.json.gz",
];

let pool: BankQuestion[] | undefined;
function questions() {
  pool ??= bankFiles.flatMap(file => {
    const bank: { questions: Record<string, BankQuestion> } = JSON.parse(
      gunzipSync(readFileSync(join(process.cwd(), file))).toString("utf8"),
    );
    return Object.values(bank.questions);
  });
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
