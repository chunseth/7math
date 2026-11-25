import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { CourseGrade, Question } from "./model";

export type BankQuestion = Question & { answer: string };
type CourseBank = {
  version: number;
  levels: { id: string; title: string; pool: { q: string }[] }[];
  questions: Record<string, BankQuestion>;
};

const files = {
  6: "content/6math/bank.json.gz",
  7: "content/mentalist/bank-v5.json.gz",
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
