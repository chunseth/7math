import type { CourseGrade, Question } from "../mentalist/model";

export const verificationGrades = [6, 7, 8] as const;

export type ReviewCase = {
  id: string;
  grade: CourseGrade;
  bankVersion: number;
  level: string;
  questionId: string;
  question: Question;
};

export type ReviewSet = { id: string; cases: ReviewCase[] };
export type ReviewDecision = {
  id: string;
  status: "accepted" | "flagged" | "skipped";
  note: string | null;
  savedAt: string;
};

export function nextReview(set: ReviewSet, decisions: Record<string, ReviewDecision>) {
  return set.cases.find(item => !decisions[item.id]);
}

export function countReviews(set: ReviewSet, decisions: Record<string, ReviewDecision>) {
  const counts = { total: set.cases.length, accepted: 0, flagged: 0, skipped: 0 };
  for (const { id } of set.cases) {
    const status = decisions[id]?.status;
    if (status) counts[status]++;
  }
  return counts;
}
