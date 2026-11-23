import type { CourseGrade, Question } from "../mentalist/model";

export const verificationGrades = [6, 7, 8] as const;
export const verificationWorlds = {
  6: { name: "Foundations", focus: "Numbers, measurement, and data displays", sprite: "griffin" },
  7: { name: "Connections", focus: "Proportions, algebra, and probability", sprite: "raijin" },
  8: { name: "Models", focus: "Transformations, functions, and sampling", sprite: "phoenix" },
} as const;

export type ReviewCase = {
  id: string;
  level: string;
  questionId: string;
  question: Question;
  note: string;
  workedExample?: boolean;
};
export type ReviewCheckpoint = { title: string; cases: ReviewCase[] };
export type ReviewChapter = { title: string; checkpoints: ReviewCheckpoint[] };
export type ReviewWorld = { grade: CourseGrade; version: number; chapters: ReviewChapter[] };
export type ReviewDecision = {
  id: string;
  status: "accepted" | "flagged";
  note: string | null;
  savedAt: string;
};
export type ReviewCounts = { accepted: number; flagged: number; total: number };

export function reviewCases(world: ReviewWorld) {
  return world.chapters.flatMap(chapter => chapter.checkpoints.flatMap(checkpoint => checkpoint.cases));
}

export function countReviews(world: ReviewWorld, decisions: Record<string, ReviewDecision>): ReviewCounts {
  const examples = reviewCases(world);
  return {
    total: examples.length,
    accepted: examples.filter(example => decisions[example.id]?.status === "accepted").length,
    flagged: examples.filter(example => decisions[example.id]?.status === "flagged").length,
  };
}
