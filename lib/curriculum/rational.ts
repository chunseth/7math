export type Rational = { numerator: bigint; denominator: bigint };

export function rational(numerator: bigint | number, denominator: bigint | number = 1): Rational {
  let n = BigInt(numerator), d = BigInt(denominator);
  if (d === BigInt(0)) throw new Error("Denominator cannot be zero");
  if (d < BigInt(0)) { n = -n; d = -d; }
  let a = n < BigInt(0) ? -n : n, b = d;
  while (b) { const remainder = a % b; a = b; b = remainder; }
  return { numerator: n / a, denominator: d / a };
}

/** Bounded, explicit grammar: integers, decimals, fractions, and mixed numbers. No eval. */
export function parseAnswer(raw: string): Rational | null {
  const text = raw.trim().replace(/−/g, "-");
  if (!text || text.length > 64) return null;
  const mixed = /^([+-]?)(\d{1,12})\s+(\d{1,12})\s*\/\s*(\d{1,12})$/.exec(text);
  if (mixed) {
    const [, sign, whole, top, bottom] = mixed;
    const n = BigInt(top), d = BigInt(bottom);
    if (!d || n >= d) return null;
    return rational((BigInt(whole) * d + n) * BigInt(sign === "-" ? -1 : 1), d);
  }
  const fraction = /^([+-]?\d{1,12})\s*\/\s*([+-]?\d{1,12})$/.exec(text);
  if (fraction) return BigInt(fraction[2]) ? rational(BigInt(fraction[1]), BigInt(fraction[2])) : null;
  if (!/^[+-]?(?:\d{1,12}(?:\.\d{0,12})?|\.\d{1,12})$/.test(text)) return null;
  const negative = text.startsWith("-");
  const [whole, decimal = ""] = text.replace(/^[+-]/, "").split(".");
  return rational(BigInt((whole || "0") + decimal) * BigInt(negative ? -1 : 1), BigInt(10) ** BigInt(decimal.length));
}
export function equal(a: Rational, b: Rational) {
  return a.numerator === b.numerator && a.denominator === b.denominator;
}
export function formatRational(value: Rational) {
  return value.denominator === BigInt(1) ? String(value.numerator) : `${value.numerator}/${value.denominator}`;
}
export function calculate(a: Rational, b: Rational, operation: "add" | "subtract" | "multiply" | "divide"): Rational {
  if (operation === "add") return rational(a.numerator*b.denominator+b.numerator*a.denominator,a.denominator*b.denominator);
  if (operation === "subtract") return rational(a.numerator*b.denominator-b.numerator*a.denominator,a.denominator*b.denominator);
  if (operation === "multiply") return rational(a.numerator*b.numerator,a.denominator*b.denominator);
  return rational(a.numerator*b.denominator,a.denominator*b.numerator);
}
