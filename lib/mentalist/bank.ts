import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { fieldCheckText, fieldFormat, fieldValue, hasSequentialFields, type CourseGrade, type Question } from "./model";

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
  7: "content/mentalist/bank-v7.json.gz",
  8: "content/8math/bank.json.gz",
};
const banks = new Map<CourseGrade, CourseBank>();

export function readCourseBank(grade: CourseGrade): CourseBank {
  let bank = banks.get(grade);
  if (!bank) {
    bank = JSON.parse(gunzipSync(readFileSync(join(process.cwd(), files[grade]))).toString("utf8")) as CourseBank;
    banks.set(grade, bank);
  }
  return bank;
}
