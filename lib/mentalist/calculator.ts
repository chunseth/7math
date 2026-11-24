import { calculate, parseAnswer, rational, type Rational } from "../curriculum/rational";
import type { Control } from "./model";

export function calculatorSettings(prompt: string, control: Control) {
  const numeric = ["whole", "decimal", "fraction"].includes(control.kind);
  const pi = /π\s*(?:=|≈)\s*(\d+(?:\.\d+)?)/.exec(prompt)?.[1];
  const circleArea = numeric && /\barea\b/i.test(prompt) && (pi || /\b(?:circle|semicircle)\b/i.test(prompt)) &&
    !/coefficient of π|divided by π|multiplies π|in terms of π/i.test(prompt);
  const compound = (numeric || control.kind === "table") && /\bcompound(?:ed|ing| interest)\b/i.test(prompt);
  const factorial = numeric && /\bfactorial\b|\b(?:\d+|[nkr])\s*!/i.test(prompt);
  return circleArea || compound || factorial ? { pi: pi ?? "3.14159265359" } : null;
}

export function evaluateCalculation(expression: string, pi: string): Rational {
  const input = expression.replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-").replace(/\s/g, "");
  if (!input || input.length > 128) throw new Error("Enter a calculation up to 128 characters.");
  const tokens = input.match(/\d+(?:\.\d*)?|\.\d+|[+*\/^()!%π-]/g) ?? [];
  if (tokens.join("") !== input) throw new Error("Use numbers, π, or the calculator keys.");
  let index = 0;

  function sum(): Rational {
    let result = product();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operation = tokens[index++] === "+" ? "add" : "subtract";
      result = calculate(result, product(), operation);
    }
    return result;
  }
  function product(): Rational {
    let result = signed();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operation = tokens[index++] === "*" ? "multiply" : "divide";
      result = bounded(calculate(result, signed(), operation));
    }
    return result;
  }
  function signed(): Rational {
    if (tokens[index] === "+") { index++; return signed(); }
    if (tokens[index] === "-") { index++; const value = signed(); return rational(-value.numerator, value.denominator); }
    const value = postfix();
    if (tokens[index] !== "^") return value;
    index++;
    const power = signed();
    if (power.denominator !== BigInt(1) || power.numerator < -BigInt(60) || power.numerator > BigInt(60)) throw new Error("Use a whole-number power from −60 to 60.");
    const exponent = power.numerator < BigInt(0) ? -power.numerator : power.numerator;
    const top = value.numerator ** exponent, bottom = value.denominator ** exponent;
    return bounded(power.numerator < BigInt(0) ? rational(bottom, top) : rational(top, bottom));
  }
  function postfix(): Rational {
    let value = primary();
    while (tokens[index] === "!" || tokens[index] === "%") {
      if (tokens[index++] === "%") value = rational(value.numerator, value.denominator * BigInt(100));
      else {
        if (value.denominator !== BigInt(1) || value.numerator < BigInt(0) || value.numerator > BigInt(100)) throw new Error("Use factorial with a whole number from 0 to 100.");
        let result = BigInt(1);
        for (let n = BigInt(2); n <= value.numerator; n++) result *= n;
        value = rational(result);
      }
    }
    return value;
  }
  function primary(): Rational {
    const token = tokens[index++];
    if (token === "(") {
      const value = sum();
      if (tokens[index++] !== ")") throw new Error("Close the parentheses before calculating.");
      return value;
    }
    const value = token && parseAnswer(token === "π" ? pi : token);
    if (!value) throw new Error("Finish the calculation before pressing equals.");
    return value;
  }

  const result = bounded(sum());
  if (index !== tokens.length) throw new Error("Put an operation between values.");
  return result;
}

function bounded(value: Rational) {
  if (`${value.numerator}`.length > 220 || `${value.denominator}`.length > 220) throw new Error("That result is too large for the calculator.");
  return value;
}

export function calculatorDecimal(value: Rational, places: number) {
  const magnitude = value.numerator < BigInt(0) ? -value.numerator : value.numerator;
  const scaled = magnitude * BigInt(10) ** BigInt(places);
  const rounded = scaled / value.denominator + ((scaled % value.denominator) * BigInt(2) >= value.denominator ? BigInt(1) : BigInt(0));
  const digits = rounded.toString().padStart(places + 1, "0");
  const sign = value.numerator < BigInt(0) && rounded !== BigInt(0) ? "-" : "";
  return places ? `${sign}${digits.slice(0, -places)}.${digits.slice(-places)}` : sign + digits;
}

export function calculatorResponse(value: Rational, control: Control): string | null {
  if (control.kind === "decimal") return calculatorDecimal(value, control.places ?? 0);
  if (control.kind === "fraction") return `${value.numerator}/${value.denominator}`;
  return value.denominator === BigInt(1) ? value.numerator.toString() : null;
}
