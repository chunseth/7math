import { createHash } from "node:crypto";
import { publicQuestion, readCourseBank, type BankQuestion } from "../mentalist/bank";
import { reviewFormat } from "./formats";
import { verificationGrades, type ReviewCase, type ReviewSet } from "./model";

type CaseSource = Omit<ReviewCase, "question"> & { question: BankQuestion };
type VerificationCatalog = { set: ReviewSet; sources: Map<string, CaseSource> };
let catalog: VerificationCatalog | undefined;

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function verificationCatalog(): VerificationCatalog {
  if (catalog) return catalog;
  const versions: number[] = [];
  const representatives = new Map<string, CaseSource>();
  for (const grade of verificationGrades) {
    const bank = readCourseBank(grade);
    versions.push(bank.version);
    for (const level of bank.levels) for (const { q: questionId } of level.pool) {
      const question = bank.questions[questionId];
      if (!question) throw new Error("Missing verification question " + questionId);
      const format = reviewFormat(question);
      const id = [grade, level.id, questionId].join(":");
      const current = representatives.get(format);
      // Select across courses without favoring whichever bank loads first.
      if (!current || compare(hash(id), hash(current.id)) < 0) {
        representatives.set(format, { id, grade, bankVersion: bank.version, level: level.id, questionId, question });
      }
    }
  }
  const selected = [...representatives.entries()]
    .map(([format, item]) => ({ item, order: hash(format) }))
    .sort((a, b) => compare(a.order, b.order))
    .map(({ item }) => item);
  const id = "combined-v1-" + hash(JSON.stringify([versions, selected.map(item => item.id)])).slice(0, 24);
  catalog = {
    set: { id, cases: selected.map(item => ({ ...item, question: publicQuestion(item.question) })) },
    sources: new Map(selected.map(item => [item.id, item])),
  };
  return catalog;
}
