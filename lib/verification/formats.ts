import type { BankQuestion } from "../mentalist/bank";
import { calculatorSettings } from "../mentalist/calculator";
import { leastOrder } from "../mentalist/least-order";
import { fieldFormat, hasSequentialFields, type Control } from "../mentalist/model";
import { hasWhiteboard } from "../mentalist/presentation";
import { fieldUnit, responseUnit } from "../mentalist/units";

// Keep these inventories aligned with Visual and Answer. A new renderer needs
// an explicit coverage classification before it can enter the review set.
const visuals = new Set([
  "balance", "bars", "benchmark-percent", "boxes", "chips", "counters", "data", "dotplot", "dots", "faces",
  "histogram", "hundred", "intersection", "loan", "net", "percent", "percent-bar", "pie", "plot",
  "pythagorean", "scaled-axis", "scatter", "sets", "signed-groups", "simulation", "triangle",
]);
const controls = new Set([
  "boxplot", "choice", "decimal", "dotplot", "drawing", "fraction", "graph", "histogram", "line", "list",
  "net", "ray", "record", "scatterplot", "simulation", "stem-plot", "story", "table", "tree", "whole",
]);

function unitFormat(unit?: string) {
  if (!unit) return "none";
  if (unit === "%") return "percent";
  if (unit === "percentage points") return "percentage points";
  if (/\$|dollars?|cents?/.test(unit)) return /per /.test(unit) ? "currency rate" : "currency";
  if (/\/(?!\s)|per /.test(unit)) return "rate";
  if (/²|square/.test(unit)) return "area";
  if (/³|cubic/.test(unit)) return "volume";
  return unit === "°" ? "degrees" : "quantity";
}

function numberFormat(control: Control) {
  return [control.kind, control.signed ? "signed" : "unsigned", control.places ?? 0];
}

export function reviewFormat(question: BankQuestion) {
  const { control, visual, prompt, answer } = question;
  if (!controls.has(control.kind)) throw new Error("Unclassified answer format: " + control.kind);
  if (visual && !visuals.has(visual.kind)) throw new Error("Unclassified question visual: " + visual.kind);

  const presentation = visual && [
    visual.kind,
    visual.kind === "net" || visual.kind === "faces" ? visual.solid : null,
    visual.kind === "benchmark-percent" ? visual.labels?.[0] : null,
    visual.kind === "simulation" ? visual.coinTrials ? "coin" : visual.sampleSize ? "samples" : "trials" : null,
  ];

  const calculator = calculatorSettings(prompt, control);
  let interaction: unknown = control.kind;
  if (visual?.coinTrials || visual?.kind === "loan") interaction = visual.coinTrials ? "coin trials" : "loan calculator";
  else if (leastOrder(question)) interaction = "number bubbles";
  else if (control.options) interaction = ["choice", control.options.length, control.options.every(o => /^-?[\d./]+$/.test(o))];
  else if (control.limit) {
    if (control.kind === "line") {
      interaction = ["line", control.step ?? 1, Boolean(control.origin), Math.sign(Number(answer.split(",")[0]))];
    } else {
      const quadrants = answer.split(";").map(point => point.split(",").map(Number).map(Math.sign).join(","));
      interaction = [control.kind, control.points ?? 1, control.step ?? 1,
        quadrants.every(q => q === quadrants[0]) ? quadrants[0] : "multiple"];
    }
  } else if (hasSequentialFields(control)) {
    const answers = answer.split("|");
    interaction = [control.kind, control.kind === "ray" ? answers.slice(1) : null, control.fields?.map((field, i) => {
      const number = fieldFormat(control, i, answers[i]);
      return number ? [...numberFormat(number), unitFormat(fieldUnit(question, i))] : ["buttons", field.options.length];
    })];
  } else if (["whole", "decimal", "fraction"].includes(control.kind)) {
    interaction = numberFormat(control);
  }

  const calculatorFormat = calculator && (/factorial|\b\d+\s*!/i.test(prompt) ? "factorial"
    : /compound/i.test(prompt) ? "compound interest" : calculator.pi === "3.14159265359" ? "pi" : "stated pi");
  return JSON.stringify([presentation, interaction, calculatorFormat, hasWhiteboard(prompt), unitFormat(responseUnit(question))]);
}
