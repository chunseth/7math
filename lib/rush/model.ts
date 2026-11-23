import type { LevelPack } from "../mentalist/round";

export const rushLength = 12;

export type RushRun = { pack: LevelPack; ranked: boolean };
export type RushResult = { score: number; elapsedMs: number };
export type RushRecord = RushResult & { rank: number; username: string };
export type RushBoard = { username: string; records: RushRecord[] };
