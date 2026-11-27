import { createHash } from "node:crypto";
import { publicQuestion, readCourseBank, type BankQuestion } from "../mentalist/bank";
import { reviewFormat } from "./formats";
import { reportedQuestions } from "./reported-questions";
import type { ReviewCase, ReviewSet } from "./model";

type CaseSource = Omit<ReviewCase, "question"> & { question: BankQuestion };
type VerificationCatalog = { set: ReviewSet; sources: Map<string, CaseSource> };
let catalog: VerificationCatalog | undefined;

export function verificationCatalog(): VerificationCatalog {
  if (catalog) return catalog;
  const sources = new Map<string, CaseSource>();
  const cases = reportedQuestions.map(([grade, level, questionId]): ReviewCase => {
    const bank = readCourseBank(grade);
    const question = bank.questions[questionId];
    const pool = bank.levels.find(item => item.id === level)?.pool;
    const id = [grade, level, questionId].join(":");
    if (!question || !pool?.some(slot => slot.q === questionId)) throw new Error("Missing reported question " + id);
    if (sources.has(id)) throw new Error("Duplicate reported question " + id);

    reviewFormat(question);
    const item = { id, grade, bankVersion: bank.version, level, questionId, question };
    sources.set(id, item);
    return { ...item, question: publicQuestion(question) };
  });

  const digest = createHash("sha256")
    .update(JSON.stringify(cases.map(({ id, bankVersion }) => [id, bankVersion]))).digest("hex");
  catalog = { set: { id: "reported-v1-" + digest.slice(0, 24), cases }, sources };
  return catalog;
}
