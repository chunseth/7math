import type { CourseGrade } from "../mentalist/model";
import type { LevelPack } from "../mentalist/round";

export const rushLength = 12;

export const rushGrades = [6, 7, 8] as const satisfies readonly CourseGrade[];
export type RushGrade = typeof rushGrades[number];

export function rushGrade(value: unknown): RushGrade | undefined {
  return rushGrades.find(grade => value === grade || value === String(grade));
}

export type RushRun = { grade: RushGrade; pack: LevelPack; ranked: boolean };
export type RushResult = { score: number; elapsedMs: number };
export type RushRecord = RushResult & { rank: number; username: string };
export type RushBoard = { grade: RushGrade; username: string; records: RushRecord[] };
export type RushSaved = RushResult & { board?: RushBoard };
