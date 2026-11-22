from fractions import Fraction as F
from operator import add, sub, mul, truediv
from formats import q, choose, fields, grid, chart, table, mixed

OPS = {
    "add": (add, "+"),
    "subtract": (sub, "−"),
    "multiply": (mul, "×"),
    "divide": (truediv, "÷"),
}


def arithmetic(skill, level, n, v):
    family, op = skill.split(".")
    fn, symbol = OPS[op]
    a, b = F(2 + n % 19), F(1 + (n * 3 + v) % 11)
    kind = "whole"
    story = None
    if family == "signed":
        if op == "add":
            if level == 1 and v % 2:
                a, b = -a, -b
            if level == 2 or (level == 3 and v != 2):
                if v % 2:
                    a = -a
                else:
                    b = -b
            if level == 3 and v == 2:
                a = F(0)
        elif op == "subtract":
            if v % 2:
                a = -a
            if level == 2 or (level == 3 and v == 1):
                b = -b
            if level == 3 and v == 2:
                b = F(0)
        else:
            if op == "divide":
                a *= b
            if v in (1, 3):
                a = -a
            if v in (2, 3):
                b = -b
            if v == 4:
                a = F(0)
            if level == 2:
                if op == "multiply":
                    a = abs(a)
                    b = -abs(b) if v == 1 else abs(b)
                    story = f"A lift moves {b} m each minute for {a} minutes. What is its change in height in meters?"
                else:
                    b = abs(b)
                    story = f"The temperature changes {a}° over {b} equal hours. What is the change per hour?"
    elif family == "decimal":
        kind = "decimal"
        a, b = F(n + 12, 10 if v != 1 else 100), F(2 + (n % 17), 10)
        if op == "divide":
            a *= b
        if level == 2:
            if v != 1:
                a = -a
            if v != 0:
                b = -b
        if level == 3:
            da, db = float(a), float(b)
            story = {
                "add": f"Two ribbons measure {da:g} m and {db:g} m. Find their combined length in meters.",
                "subtract": f"A trail marker is at {da:g} km and the next at {db:g} km. Find the signed change from the second marker to the first.",
                "multiply": f"A rectangle is {da:g} m by {db:g} m. Find its area in square meters.",
                "divide": f"A {da:g} m strip is cut into pieces {db:g} m long. How many pieces does that length represent, including partial pieces?",
            }[op]
    else:
        kind = "fraction"
        d = 3 + n % 8
        a, b = F(1 + n % 17, d), F(
            1 + n % 5, d if level == 1 and op in ("add", "subtract") else d + 2
        )
        if level == 1 and op in ("add", "subtract"):
            # Keep the printed denominators equal even when an operand reduces.
            operands = (f"{1+n%17}/{d}", f"{1+n%5}/{d}")
        else:
            operands = None
        if level == 2 and op in ("add", "subtract") and a.denominator == b.denominator:
            b = F(1, a.denominator + 1)
        if level == 3 if op in ("add", "subtract") else level == 2:
            if v != 1:
                a = -a
            if v != 0:
                b = -b
        if level == (4 if op in ("add", "subtract") else 3):
            a = F(n % 7 + 1) + F(1, d)
            b = F(v + 1) + F(1, d + 1)
            operands = (mixed(a), mixed(b))
    if family != "fraction" or operands is None:
        operands = tuple(
            f"{float(z):g}" if family == "decimal" else str(z) for z in (a, b)
        )
    if op in ("add", "multiply") and family != "signed" and n % 2:
        operands = operands[::-1]
    prompt = (
        story or f"{operands[0]} {symbol} ({operands[1]})"
        if operands[1].startswith("-")
        else story or f"{operands[0]} {symbol} {operands[1]}"
    )
    return q(prompt, fn(a, b), kind, signed=family == "signed" or level > 1)


def fact(operation, table, operand, reverse=False):
    if operation == "review.multiply":
        left, right = (operand, table) if reverse else (table, operand)
        row = q(f"{left} × {right}", table * operand)
        row["id"] = f"fact.multiply.{left}.{right}"
        row["family"] = f"multiply.{min(table,operand)}.{max(table,operand)}"
    else:
        divisor, quotient = (operand, 0) if table == 0 else (table, operand)
        dividend = divisor * quotient
        row = q(f"{dividend} ÷ {divisor}", quotient)
        row["id"] = f"fact.divide.{dividend}.{divisor}"
    return row


def review(s, l, n, v):
    a = 2 + n % 30
    b = 2 + (3 * n + 1) % 11
    if s in ("review.add", "review.subtract"):
        if l == 1:
            a, b = n % 10, (10 - n % 10 if v == 1 else (n // 2 + v) % 10)
        if l == 2:
            a, b = 15 + n % 46, 5 + n % 23
        if l == 3:
            a, b = 110 + n * 7, 25 + n
        if s == "review.subtract":
            return q(f"{a+b} − {b}", a) if n % 2 else q(f"{a+b} − {a}", b)
        if l == 3 and v == 1:
            return q(f"{a} + □ = {a+b}", b)
        return q(f"{b} + {a}", a + b) if n % 2 else q(f"{a} + {b}", a + b)
    if s == "review.whole":
        return [
            q(f"{a} × □ = {a*b}", b),
            q(f"{a*10} × {b}", a * b * 10),
            q(f"{a+11} × {b+10}", (a + 11) * (b + 10)),
            q(f"{a*b} ÷ {b}", a),
        ][l - 1]
    if s == "review.factors":
        return (
            q(f"Find the greatest common factor of {a*2} and {a*3}.", a)
            if l == 1
            else q(f"Find the least common multiple of {a*2} and {a*3}.", a * 6)
        )
    if s == "review.fractions":
        return [
            q(f"Fill the numerator: 1/{a} = □/{a*b}.", b),
            q(f"Simplify {b}/{a*b}.", F(1, a), "fraction"),
            choose(
                f"Which is greater: 1/{a} or 1/{a+1}?",
                f"1/{a}",
                [f"1/{a+1}", "Equal"],
                n,
            ),
            q(f"Write {a} 1/{b} as an improper fraction.", F(a * b + 1, b), "fraction"),
        ][l - 1]
    if s == "review.conversions":
        return [
            q(f"Write {a}/20 as a decimal.", F(a, 20), "decimal"),
            q(f"Write {a/100:g} as a percent.", a),
            q(f"Write {a}% as a fraction.", F(a, 100), "fraction"),
            choose(f"Which is closest to {a}.89?", a + 1, [a, a + 2], n),
        ][l - 1]
    if s == "review.numberline":
        if l == 1:
            return q(f'Find the {"opposite" if v%2 else "absolute value"} of −{a}.', a)
        if l == 2:
            return choose(f"Which is smallest: −{a}, 0, or {a}?", f"−{a}", ["0", a], n)
        x = n % 19 - 9
        return grid(f"Place {x} on the number line.", x, 0, 10, "line")
    if s == "review.expressions":
        return [
            q(f"{a} + {b} × 3", a + 3 * b),
            q(f"Find 2x + {b} when x = {a}.", 2 * a + b),
            q(f"{a}x + {b}x = □x", a + b),
            q(f"{a}(x + {b}) = {a}x + □", a * b),
        ][l - 1]
    if s == "review.coordinate":
        x = (n % 9 + 1) * (-1 if v != 1 else 1)
        y = (n // 3 % 9 + 1) * (-1 if v == 0 else 1)
        if l == 1:
            return grid(f"Plot ({x}, {y}).", x, y)
        return q(
            f"Each square represents {b} liters. How many liters do {a} squares represent?",
            a * b,
        )
    if s == "review.area":
        typ = (v + n) % 4 if l == 5 else l - 1
        return [
            q(f"A rectangle is {a} cm by {b} cm. Area in cm²?", a * b),
            q(
                f"Parallelogram base {a} cm, perpendicular height {b} cm. Area in cm²?",
                a * b,
            ),
            q(
                f"Triangle base {2*a} cm, perpendicular height {b} cm. Area in cm²?",
                a * b,
            ),
            q(
                f"Trapezoid bases {a} and {a+2} cm, height {b} cm. Area in cm²?",
                (a + 1) * b,
            ),
        ][typ]
    if s == "review.angles":
        total = 180 if v % 2 else 90
        return [
            q(f"Two angles total {total}°. One is {a}°. Find the other.", total - a),
            q(f"An angle is {a}°. Find its vertical angle.", a),
            q(
                f"Two angles in a triangle are {a}° and {b}°. Find the third.",
                180 - a - b,
            ),
        ][l - 1]
    if s == "review.data":
        if l == 1:
            return q(
                f'Find the {"mean" if v%2 else "median"} of {a}, {a+2}, {a+4}.', a + 2
            )
        if l == 2:
            return q(f"Quartiles are {a}, {a+b}, {a+2*b}. Find the IQR.", 2 * b)
        vis = chart("dots", [1, 2, 3, 2, 1], [str(a + i) for i in range(5)])
        return (
            choose(
                f"Describe the shape around {a+2}.",
                "Symmetric",
                ["Right-skewed", "Left-skewed"],
                n,
                vis,
            )
            if l == 3
            else q("What value occurs most often?", a + 2, visual=vis)
        )
    if s == "review.onestep":
        if l == 1:
            return q(f"x + {b} = {a+b}. Find x.", a)
        if l == 2:
            return q(f"x + {b} > {a+b}. What is the boundary value?", a)
        x = n % 17 - 8
        return grid(f"Mark the solution to x + {b} = {x+b}.", x, 0, 10, "line")
    raise KeyError(s)
