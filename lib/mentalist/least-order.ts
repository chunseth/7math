import type { Question } from "./model";

const prefix = "order:";

export function numberOrder(question: Question) {
  const { kind, options } = question.control;
  const direction = /^Which is (least|greatest):/.exec(question.prompt)?.[1];
  if (!direction || kind !== "choice" || options?.length !== 3 ||
      !options.every(value => /^-?\d{1,12}$/.test(value)) || new Set(options.map(Number)).size !== 3) return;
  return { direction, values: [...options].sort((a, b) => direction === "least" ? Number(a) - Number(b) : Number(b) - Number(a)) };
}

export function studentPrompt(question: Question) {
  const order = numberOrder(question);
  if (!order) return question.prompt;
  return order.direction === "least" ? "Pop the numbers from least to greatest." : "Pop the numbers from greatest to least.";
}

export function leastOrderAttempt(picks: string[]) {
  return prefix + picks.join("|");
}

export function displayAttempt(raw: string) {
  return raw.startsWith(prefix) ? raw.slice(prefix.length).split("|").join(", ") : raw;
}

// Keep existing choice keys and old saved answers. For bubble attempts, map a
// finished order to its first value and a mistake to the value at the wrong tap.
export function responseForGrade(question: Question, raw: string) {
  if (!raw.startsWith(prefix)) return raw;
  if (raw.length > 256) return null;
  const order = numberOrder(question)?.values;
  const picks = raw.slice(prefix.length).split("|");
  if (!order || picks.length > order.length || new Set(picks).size !== picks.length ||
      !picks.every(value => order.includes(value))) return null;
  const mistake = picks.findIndex((value, i) => value !== order[i]);
  if (mistake >= 0) return mistake === picks.length - 1 ? picks[mistake] : null;
  return picks.length === order.length ? picks[0] : null;
}
