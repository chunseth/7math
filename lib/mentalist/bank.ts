import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { curriculumVersion, fieldCheckText, fieldFormat, fieldValue, hasSequentialFields, type CourseGrade, type Question } from "./model";

export type BankQuestion = Question & { answer: string };
export function publicQuestion({ prompt, control, visual, answer }: BankQuestion): Question {
  const answers = hasSequentialFields(control) ? answer.split("|") : undefined;
  const fieldChecks = answers?.map((value, index) =>
    createHash("sha256").update(fieldCheckText(prompt, index, fieldValue(control, index, value))).digest("hex"));
  return { prompt, control, visual, fieldChecks, fieldFormats: answers?.map((value, index) => fieldFormat(control, index, value)) };
}
type CourseBank = {
  version: number;
  levels: { id: string; title: string; pool: { q: string }[] }[];
  questions: Record<string, BankQuestion>;
};

const files = {
  6: "content/6math/bank.json.gz",
  8: "content/8math/bank.json.gz",
};
const banks = new Map<string, CourseBank>();

export function readCourseBank(grade: CourseGrade, grade7Version = curriculumVersion): CourseBank {
  const file = grade === 7 ? `content/mentalist/bank-v${grade7Version}.json.gz` : files[grade];
  let bank = banks.get(file);
  if (!bank) {
    bank = JSON.parse(gunzipSync(readFileSync(join(process.cwd(), file))).toString("utf8")) as CourseBank;
    banks.set(file, bank);
  }
  return bank;
}
