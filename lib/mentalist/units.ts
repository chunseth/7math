import type { Question } from "./model";

const measure = /(?<![\w])(?:mm|cm|km|m|ft|yd|mi|kg|mg|g|oz|lb|mL|L|millimeters?|centimeters?|kilometers?|kilograms?|grams?|liters?|milliliters?|meters?|minutes?|seconds?|hours?|days?|weeks?|months?|years?|cents?|dollars?|miles?|feet|inches|yards|degrees?)(?:[²³])?(?![\w])/g;
const namedUnit = /(?:millimeters?|centimeters?|kilometers?|kilograms?|milligrams?|grams?|meters?|inches|feet|yards|miles?|liters?|milliliters?|minutes?|seconds?|hours?|days?|weeks?|months?|years?|dollars?|cents?|degrees?|mm|cm|km|m|ft|in|yd|mi|kg|mg|g|oz|lb|mL|L)/.source;
const explicitUnit = new RegExp(`\\b(?:in|how many(?: more| fewer)?|convert .+ to) (square |cubic )?(${namedUnit})([²³])?(?![\\w/])`, "i");
const symbols: Record<string, string> = {
  millimeter: "mm", millimeters: "mm", centimeter: "cm", centimeters: "cm", kilogram: "kg", kilograms: "kg",
  gram: "g", grams: "g", milligram: "mg", milligrams: "mg", degree: "°", degrees: "°",
  meter: "m", meters: "m", liter: "L", liters: "L", milliliter: "mL", milliliters: "mL",
  kilometer: "km", kilometers: "km", feet: "ft", inches: "in", yards: "yd",
  square: "²", cubic: "³",
};

export function fieldUnit(question: Question, index: number) {
  const label = question.control.fields?.[index]?.label ?? "";
  const given = /\((\$|%|[A-Za-z²³/ ]+)\)$/.exec(label)?.[1];
  if (given) return given === "$" ? "dollars" : given;
  if (question.control.kind === "net" && index === 2) return /\b(m|mm|cm|km|ft|in|yd)²/.exec(question.prompt)?.[0] ?? "square units";
  if (question.control.kind === "simulation") return /heads and tails/i.test(question.prompt) ? "tosses" : undefined;
  if (question.control.kind === "ray" || question.control.kind === "boxplot") return undefined;
  return /^Dollars per |^Liters per /.test(label) ? label.toLowerCase() : undefined;
}

export function responseUnit({ prompt, visual, control }: Question) {
  if (control.unit) return control.unit;
  const text = prompt.replace(/π\s*(?:=|≈)\s*\d+(?:\.\d+)?/g, "");
  const sentence = text.split(/(?<=[.?])\s+(?=[A-Z])|;\s+/).at(-1) ?? text;
  if (/^Find [a-z][.?]$/i.test(sentence) && text.includes("^")) return undefined;
  if (/percentage points/i.test(sentence)) return "percentage points";
  if (/\b(?:what|find|give|estimate) (?:the )?(?:percent|percentage)(?:\b| of)|\bwhat percent\b|\bas a percent\b|\bpercent change\b/i.test(sentence)) return "%";
  if (/\bpercentage\b/i.test(sentence) && /\b(?:rate|change|increase|decrease|share)\b/i.test(sentence)) return "%";
  const explicit = explicitUnit.exec(/set up a proportion/i.test(sentence) ? "" : sentence);
  if (explicit) {
    const [, power, base, exponent] = explicit;
    return (symbols[base.toLowerCase()] ?? base) + (exponent ?? symbols[power?.trim()] ?? "");
  }
  const object = /\b(?:how many(?: more| fewer)?(?: \d+(?:\/\d+)?-liter)?|maximum whole number of|\d+% of \d+) (books|bottles|tickets|students|votes|pencils|cans|crates|boxes|counters|walkers|riders|trips|observations|pennies|outfits|trials|rolls|bags|packs|apples|pounds|coins)\b/i.exec(sentence)?.[1];
  if (object) return object;
  const rate = /(?:\b(?:find|difference in|rate in|for)\s+|^)(km\/h|m\/s|mi\/h|L\/min|km\/min|mph|L\/h|liters per m²|dollars per \w+|pens per pack|grams per \w+)(?=[.?]|$)/i.exec(sentence)?.[1];
  if (rate) return rate.toLowerCase().startsWith("dollars") ? rate.toLowerCase() : rate;
  const counted = /\bhow many ([a-z]+(?: [a-z]+)?)(?= (?:are|will|would|were|does|do|fit|make|remain|could|can|have|did|must|in|is|belong)\b|[?.])/i.exec(sentence)?.[1];
  if (counted && !/^(?:more|less|possible|different|solutions|units|times|values|of)\b/.test(counted)) return counted;
  if (visual?.kind === "scaled-axis") return "L";
  if (/pages = k × days/i.test(text)) return "pages per day";
  if (/^Estimate walkers\b/i.test(sentence)) return "walkers";
  if (/Group these ages into/i.test(text)) return "observations";
  if (/^Which |\bfraction\b|\bprobability\b|\bratio of\b|\bscale factor\b|\bplot\b|\bequation\b|\bper (?:square|cubic) unit\b/i.test(sentence)) return undefined;
  if (/°/.test(text)) return /per hour/i.test(sentence) ? "° per hour" : "°";
  if (/\bpoints?\b/i.test(text) && /\b(?:leader|score|gain|ahead|behind|signed position)\b/i.test(text)) return "points";
  if (/\b(?:which|what) week\b/i.test(sentence)) return "weeks";
  if (visual?.kind === "plot" && /\b(?:distance|volume|height)\b/i.test(sentence)) {
    const y = visual.labels?.[1];
    if (y) return symbols[y.toLowerCase()] ?? y.toLowerCase();
  }
  const attached = [...text.matchAll(/\d\s*(mm|cm|km|m|ft|yd|mi|kg|mg|g|oz|lb|mL|L)([²³])?(?![\w])/g)].map(m => [m[1], m[2] ?? ""]);
  if (/\barea\b|\bsurface area\b|\bcovering\b/i.test(sentence))
    return attached.length ? attached[0][0] + "²" : "square units";
  if (/\bvolume\b/i.test(sentence))
    return attached.length ? attached[0][0] + "³" : "cubic units";
  if (/\b(?:height|length|distance|radius|width|perimeter|circumference|its partner)\b/i.test(sentence))
    return attached[0]?.[0] ?? "units";
  if ((/\b(?:dollars|checking balance)\b|\$[−-]?\d/.test(text) || visual?.labels?.some(label => label.includes("$"))) &&
      /(?:balance|cost|repay|payment|savings|spend|interest|earn|deposit|fee|price|income|profit|save|budget|how much|owed|total|tax|remains|difference|annual dollars)/i.test(sentence)) {
    if (/\b(?:per month|monthly deposit|saved monthly|monthly savings)\b/i.test(sentence)) return "dollars per month";
    if (/\b(?:per hour|hourly wage|hourly pay)\b/i.test(sentence)) return "dollars per hour";
    return "dollars";
  }
  if (/^(?:find|give|calculate|read|estimate)\b/i.test(sentence)) {
    const units = [...sentence.matchAll(measure)].map(m => m[0]);
    if (new Set(units).size === 1) return symbols[units[0]] ?? units[0];
  }
}
