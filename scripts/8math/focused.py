"""Focused Grade 8 activities. Each worked example follows the same rule as its pool."""

from fractions import Fraction as F
from math import isqrt
from random import Random
from formats import choose, fields, grid, q, table, tenth_line, scatter_task
from problems import DISTANCE_OFFSETS


def activity(key, seed):
    # Two independent small-operand cycles and a separate coordinate grid.
    n, k = 2 + (7 * seed) % 29, 2 + (5 * seed) % 7
    a, b = 1 + seed % 5, 1 + seed // 5
    sign = -1 if seed % 2 else 1

    def make(
        prompt,
        answer,
        step1,
        math1,
        step2,
        math2,
        *,
        choices=None,
        visual=None,
        point=False,
        decimal=False,
        caption=None,
    ):
        if choices is not None:
            row = choose(
                prompt, answer, choices, Random(f"{key}:{seed}").randrange(6), visual
            )
        elif point:
            row = grid(prompt, *answer, limit=max(10, *map(abs, answer)), visual=visual)
        else:
            row = q(prompt, answer, "decimal" if decimal else None, visual=visual)
        result = f"({answer[0]}, {answer[1]})" if point else row["answer"]
        clip = dict(
            model="worked",
            prompt=caption or prompt,
            steps=[
                dict(label=step1, math=str(math1)),
                dict(label=step2, math=str(math2)),
            ],
            answer=result,
            result=result,
            color="#246650",
        )
        return row, clip

    if key == "irrational":
        r = n * n + (1 if seed % 2 else 0)
        return make(
            f"Is √{r} rational or irrational?",
            "irrational" if seed % 2 else "rational",
            "Locate the nearest perfect squares.",
            f"{n}² = {n*n}, {n+1}² = {(n+1)**2}",
            "A whole number has a rational square root exactly when it is a perfect square.",
            f"{n*n} < {r} < {(n+1)**2}" if seed % 2 else f"√{r} = {n}",
            choices=["rational", "irrational"],
        )
    if key == "terminating":
        return make(
            f"Write {n/100:.2f} as a fraction in lowest terms.",
            F(n, 100),
            "Read the last decimal place.",
            "hundredths",
            "Reduce the fraction.",
            f"{n}/100 = {F(n,100)}",
        )
    if key == "repeat-digit":
        digit = 1 + seed % 8
        whole = seed // 8
        return make(
            f"Write {whole}.{digit}{digit}{digit}… as a fraction. Only {digit} repeats.",
            F(9 * whole + digit, 9),
            "Shift one place to align the repeating tails.",
            f"10x = {10*whole+digit}.{digit}{digit}…",
            "Subtract the original number, then divide by nine.",
            f"9x = {9*whole+digit}",
        )
    if key == "repeat-block":
        block = 12 + (7 * seed) % 73
        return make(
            f"Write 0.{block}{block}… as a reduced fraction. The block {block} repeats.",
            F(block, 99),
            "Shift two places to align the repeating tails.",
            f"100x = {block}.{block}…",
            "Subtract x and divide by 99.",
            f"99x = {block}",
        )
    if key in ("product-powers", "quotient-powers", "power-power"):
        left, right = sign * n, k
        if key == "product-powers":
            return make(
                f"For nonzero x, write x^({left}) × x^{right} as x^m. Find m.",
                left + right,
                "Keep the common base.",
                "x^m",
                "Add the exponents.",
                f"{left} + {right}",
            )
        if key == "quotient-powers":
            return make(
                f"For nonzero a, simplify a^({left}) ÷ a^{right} to a^m. Find m.",
                left - right,
                "The bases match.",
                "a^m",
                "Subtract the divisor's exponent.",
                f"{left} − {right}",
            )
        return make(
            f"For nonzero y, simplify (y^({left}))^{right} to y^m. Find m.",
            left * right,
            "The outer exponent repeats the inner power.",
            f"{right} factors",
            "Multiply the two exponents.",
            f"{left} × {right}",
        )
    if key == "negative-power":
        exp = 0 if seed % 4 == 0 else -(2 + seed % 2)
        return make(
            f"Evaluate {n}^({exp}) exactly.",
            F(n) ** exp,
            "Use the reciprocal for a negative exponent or cancel identical factors for zero.",
            f"1/{n}^{-exp}" if exp else f"{n}/{n}",
            "Evaluate the denominator.",
            f"1/{n**(-exp)}",
        )
    if key == "square-root":
        return make(
            f"A square has area {n*n} cm². Find its positive side length in cm.",
            n,
            "A side times itself gives the area.",
            f"s² = {n*n}",
            "Take the positive square root.",
            f"{n} × {n} = {n*n}",
        )
    if key == "cube-root":
        side = n * sign
        return make(
            f"What number cubed equals {side**3}?",
            side,
            "Find the cube root of the magnitude.",
            f"{n}³ = {n**3}",
            "An odd power preserves the sign.",
            f"({side})³ = {side**3}",
        )
    if key == "radical-between":
        r = n * n + n
        return make(
            f"What integer lies immediately below √{r}?",
            n,
            "Compare consecutive squares.",
            f"{n*n} < {r} < {(n+1)**2}",
            "Take the square root throughout.",
            f"{n} < √{r} < {n+1}",
        )
    if key == "root-midpoint":
        r = n * n + n + (seed % 2)
        above = seed % 2 == 1
        return make(
            f"Is √{r} above or below {n}.5?",
            "above" if above else "below",
            "Square the positive midpoint.",
            f"{n}.5² = {n*n+n}.25",
            "Compare squared values in the same order.",
            f"{r} {'>' if above else '<'} {n*n+n}.25",
            choices=["above", "below"],
        )
    if key == "root-tenth":
        base = 3 + seed % 12
        r = base * base + 2 + seed // 12
        lower = isqrt(100 * r)
        nearest = lower + int(400 * r > (2 * lower + 1) ** 2)
        prompt = f"Mark √{r} to the nearest tenth on the number line."
        _, clip = make(
            prompt, F(nearest, 10),
            "Find the lower neighboring tenth using squares.",
            f"{lower/10:g}² ≤ {r}",
            "Compare with the square of the halfway point.",
            f"{(lower+.5)/10:g}² = {((lower+.5)/10)**2:.4f}",
            decimal=True,
        )
        return tenth_line(prompt, nearest), clip
    if key == "order-signed":
        r = n * n + n
        return make(
            f"Choose the greater number: −√{r} or −{n}.",
            f"−{n}",
            "Compare magnitudes first.",
            f"{n}² < {r}",
            "Negating reverses the order.",
            f"−√{r} < −{n}",
            choices=[f"−√{r}"],
        )
    if key == "order-rational":
        r = n * n + (n if seed % 2 else n + 1)
        return make(
            f"Which length is larger, √{r} m or {n}.5 m?",
            f"{n}.5 m" if seed % 2 else f"√{r} m",
            "Both lengths are positive, so compare squares.",
            f"{n}.5² = {n*n+n}.25",
            "The greater square belongs to the longer length.",
            f"{r} {'<' if seed%2 else '>'} {n*n+n}.25",
            choices=[f"{n}.5 m", f"√{r} m"],
        )
    if key == "order-context":
        r = n * n + (n if seed % 2 else n + 1)
        return make(
            f"A diagonal is √{r} m long. What is its length to the nearest meter?",
            n if seed % 2 else n + 1,
            "Bracket the length.",
            f"{n} < √{r} < {n+1}",
            "Compare the squared length with the squared midpoint.",
            f"{r} {'<' if seed%2 else '>'} {n*n+n}.25",
        )
    if key in ("large-notation", "small-notation", "normalize"):
        coeff = F(n + 11, 10)
        exp = (2 + k) * (-1 if key == "small-notation" else 1)
        c = float(coeff)
        if key == "normalize":
            shift = 1 if seed % 2 else 2
            return make(
                f"Normalize {c*10**shift:g} × 10^{k}. What exponent goes with coefficient {c:g}?",
                k + shift,
                "Move the coefficient's decimal left.",
                f"{c*10**shift:g} ÷ {10**shift} = {c:g}",
                "Increase the exponent by the same number of places.",
                f"{k} + {shift}",
            )
        written = f"{c*10**exp:.{max(0,1-exp)}f}"
        return make(
            f"Write {written} as {c:g} × 10^m. Find m.",
            exp,
            "Put one nonzero digit before the decimal.",
            f"coefficient = {c:g}",
            "Count places and use the sign for the scale.",
            f"{c:g} × 10^({exp})",
        )
    if key == "sci-product":
        return make(
            f"Normalize (2 × 10^{n}) × (6 × 10^{k}). Find the final exponent.",
            n + k + 1,
            "Multiply coefficients and add exponents.",
            f"12 × 10^{n+k}",
            "Replace 12 with 1.2 times ten.",
            f"1.2 × 10^{n+k+1}",
        )
    if key == "sci-ratio":
        return make(
            f"Divide 8 × 10^{n} by 2 × 10^{k}. Find the exponent in the normalized result.",
            n - k,
            "Divide the coefficients.",
            "8 ÷ 2 = 4",
            "Subtract the exponents.",
            f"{n} − {k}",
        )
    if key == "sci-sum":
        return make(
            f"Express (3 × 10^{n}) + ({k} × 10^{n-1}) as c × 10^{n}. Find c.",
            F(30 + k, 10),
            "Rewrite the smaller power on the larger scale.",
            f"{k} ÷ 10 = {k/10:g}",
            "Add the aligned coefficients.",
            f"3 + {k/10:g}",
            decimal=True,
        )

    # Small signed coordinates keep every point accessible on the interactive grid.
    x, y = sign * a, -b if seed % 3 == 0 else b

    def point(prompt, answer, rule, intermediate):
        return make(
            prompt,
            answer,
            "Apply the coordinate rule.",
            rule,
            "Substitute the signed coordinates.",
            intermediate,
            point=True,
        )

    if key == "expand-point":
        return point(
            f"Dilate ({x}, {y}) from the origin by 2. Plot the image.",
            (2 * x, 2 * y),
            "(2x, 2y)",
            f"(2 × {x}, 2 × {y})",
        )
    if key == "reduce-point":
        return point(
            f"Dilate ({2*x}, {2*y}) from the origin by 1/2. Plot the image.",
            (x, y),
            "(x/2, y/2)",
            f"({2*x}/2, {2*y}/2)",
        )
    if key == "inverse-image":
        return point(
            f"A dilation by 3 centered at the origin sends P to ({3*x}, {3*y}). Plot the original P.",
            (x, y),
            "(x/3, y/3)",
            f"({3*x}/3, {3*y}/3)",
        )
    if key == "scale-perimeter":
        return make(
            f"A polygon of perimeter {n*k} m is dilated by 1/{k}. Find its new perimeter in meters.",
            n,
            "Each boundary length has the same scale factor.",
            f"factor = 1/{k}",
            "Scale the sum of the sides.",
            f"{n*k} ÷ {k}",
        )
    if key == "area-factor":
        return make(
            f"A shape of area {n} cm² is enlarged by length factor {k}. Find its new area.",
            n * k * k,
            "Both perpendicular directions scale.",
            f"{k} × {k} = {k*k}",
            "Multiply the original area by the area factor.",
            f"{n} × {k*k}",
        )
    if key == "undo-area":
        return make(
            f"Similar figures have areas {n} and {n*k*k}. Find the length factor from smaller to larger.",
            k,
            "Divide the image area by the original.",
            f"{n*k*k} ÷ {n} = {k*k}",
            "Take the positive square root of the area factor.",
            f"√{k*k}",
        )
    if key == "move":
        return point(
            f"Translate ({x}, {y}) right 3 and down 2. Plot the image.",
            (x + 3, y - 2),
            "(x + 3, y − 2)",
            f"({x} + 3, {y} − 2)",
        )
    if key == "undo-move":
        return make(
            f"A translation sends ({a}, {b}) to ({a+x}, {b+y}). Which vector moves the point?",
            f"({x}, {y})",
            "Subtract the starting x from the ending x.",
            f"{a+x} − {a} = {x}",
            "Subtract the starting y from the ending y.",
            f"{b+y} − {b} = {y}",
            choices=[f"({-x}, {-y})", f"({-x}, {y})"],
        )
    if key == "reflect":
        axis = "x" if seed % 2 else "y"
        return point(
            f"Reflect ({x}, {y}) across the {axis}-axis. Plot the image.",
            (x, -y) if axis == "x" else (-x, y),
            "(x, −y)" if axis == "x" else "(−x, y)",
            f"x = {x}, y = {y}",
        )
    if key in ("turn-left", "turn-right", "half-turn"):
        rotation, rule, answer = {
            "turn-left": ("90° counterclockwise", "(−y, x)", (-y, x)),
            "turn-right": ("90° clockwise", "(y, −x)", (y, -x)),
            "half-turn": ("180°", "(−x, −y)", (-x, -y)),
        }[key]
        return point(
            f"Rotate ({x}, {y}) {rotation} about the origin. Plot its image.",
            answer,
            rule,
            f"x = {x}, y = {y}",
        )
    if key == "preserve":
        motion = ["reflection", "quarter turn", "translation"][seed % 3]
        return make(
            f"A triangle has sides {n}, {n+1}, {n+2} cm. What is its perimeter after a {motion}?",
            3 * n + 3,
            "Add the original side lengths.",
            f"{n} + {n+1} + {n+2}",
            "A rigid motion preserves each length.",
            f"p = {3*n+3}",
        )
    if key == "orientation":
        ans = "clockwise" if n % 2 else "counterclockwise"
        return make(
            f"A counterclockwise triangle undergoes {n} reflections. In what order do its vertices run afterward?",
            ans,
            "Each reflection reverses orientation.",
            "2 reflections restore order",
            "Check whether a reflection is left unpaired.",
            f"{n} = 2 × {n//2} + {n%2}",
            choices=["clockwise", "counterclockwise"],
        )
    if key == "rigid-scale":
        f = 1 if seed % 2 else k
        return make(
            f"A triangle with a {n} cm side is dilated by {f}, then rotated. Is the image congruent to the original?",
            "yes" if f == 1 else "no",
            "Scale the side length.",
            f"{n} × {f} = {n*f}",
            "Rotation preserves the resulting side.",
            f"{n*f} {'=' if f==1 else '≠'} {n}",
            choices=["yes", "no"],
        )
    if key in ("move-reflect", "reflect-move", "reverse-sequence"):
        if key == "move-reflect":
            return make(
                f"Translate ({x}, {y}) right 2, then reflect across the y-axis. Plot the image.",
                (-x - 2, y),
                "Apply the translation first.",
                f"({x+2}, {y})",
                "Negate the new x-coordinate.",
                f"x = −({x+2})",
                point=True,
            )
        if key == "reflect-move":
            return make(
                f"Reflect ({x}, {y}) across the y-axis, then shift right 2. Plot the image.",
                (2 - x, y),
                "Negate x in the reflection.",
                f"({-x}, {y})",
                "Now add two to the reflected x.",
                f"{-x} + 2",
                point=True,
            )
        return make(
            f"A shift up 3 followed by an x-axis reflection ends at ({x}, {y}). Plot the starting point.",
            (x, -y - 3),
            "Undo the reflection first.",
            f"({x}, {-y})",
            "Undo the upward shift.",
            f"{-y} − 3",
            point=True,
        )
    if key in ("parallel-equal", "parallel-sum"):
        angle = 50 + 3 * n
        relation = (
            ("alternate interior" if seed % 2 else "corresponding")
            if key == "parallel-equal"
            else "same-side interior"
        )
        return make(
            f"A transversal crosses parallel lines. One angle is {angle}°. Find its {relation} partner in degrees.",
            angle if key == "parallel-equal" else 180 - angle,
            "Identify the angle relationship.",
            relation,
            (
                "Use equal measures."
                if key == "parallel-equal"
                else "Subtract the known angle from a straight angle."
            ),
            f"x = {angle}" if key == "parallel-equal" else f"180 − {angle}",
        )
    if key == "exterior":
        angle_a, angle_b = n + 15, 2 * k + 30
        angle_c = 180 - angle_a - angle_b
        return make(
            f"In triangle ABC, angles A and B are {angle_a}° and {angle_b}°. Side BC extends past C to D. Find exterior angle ACD.",
            angle_a + angle_b,
            "Find interior angle C.",
            f"180 − {angle_a} − {angle_b} = {angle_c}",
            "Exterior angle ACD and interior angle C form a straight line.",
            f"180 − {angle_c}",
        )
    if key == "aa":
        angle = n + 20
        other = 60 + k
        extra = seed % 2
        return make(
            f"A triangle has angles {angle}° and {other}°. Another has {angle}° and {other+extra}°. Are they similar?",
            "yes" if not extra else "no",
            "Find the unlisted angles.",
            f"{180-angle-other}° and {180-angle-other-extra}°",
            "Compare all three measures to test AA.",
            f"{other}° {'=' if not extra else '≠'} {other+extra}°",
            choices=["yes", "no"],
        )
    if key == "rise-run":
        dy = sign * n
        dx = k
        return make(
            f"Moving from ({k}, {n}) to ({2*k}, {n+dy}), what is the signed {'rise' if seed%3 else 'run'}?",
            dy if seed % 3 else dx,
            "Subtract x-coordinates for the run.",
            f"{2*k} − {k} = {dx}",
            "Subtract y-coordinates for the rise.",
            f"{n+dy} − {n} = {dy}",
        )
    if key == "slope-ratio":
        return make(
            f"A line passes through (1, {k}) and ({1+k}, {k+sign*n}). Find its slope.",
            F(sign * n, k),
            "Find the vertical change.",
            f"{k+sign*n} − {k} = {sign*n}",
            "Divide by the horizontal change.",
            f"{sign*n}/{k}",
        )
    if key == "slope-triangles":
        return make(
            f"One slope triangle has run {k} and rise {sign*n}. A second on the same line has run {3*k}. Find its signed rise.",
            3 * sign * n,
            "Compare the horizontal legs.",
            f"{3*k} ÷ {k} = 3",
            "Scale the vertical change by the same factor.",
            f"3 × ({sign*n})",
        )
    if key == "origin":
        offset = n if seed % 2 else 0
        return make(
            f"Does y = {n}x + {offset} describe direct variation?",
            "no" if offset else "yes",
            "Substitute zero for the input.",
            f"y = {n} × 0 + {offset}",
            "A direct variation line contains the origin.",
            f"(0, {offset})",
            choices=["yes", "no"],
        )
    if key == "ratios-table":
        last = 3 * n + (seed % 2) * k
        return make(
            "Do all rows have the same output-to-input ratio?",
            "no" if seed % 2 else "yes",
            "Divide in the first two rows.",
            f"{n}/1 = {2*n}/2 = {n}",
            "Compare with the third ratio.",
            f"{last}/3 {'≠' if seed%2 else '='} {n}",
            choices=["yes", "no"],
            visual=table(["Input", "Output"], [(1, n), (2, 2 * n), (3, last)]),
            caption=f"Do (1, {n}), (2, {2*n}) and (3, {last}) have the same output-to-input ratio?",
        )
    if key == "compare-fees":
        return make(
            f"A costs ${k} per ride. B charges ${n} plus ${k} per ride. How many dollars more does B cost after {k+1} rides?",
            n,
            "Find the shared per-ride total.",
            f"{k} × {k+1} = {k*(k+1)}",
            "Subtract the totals to isolate the fixed fee.",
            f"{n+k*(k+1)} − {k*(k+1)}",
        )
    if key in ("unique-output", "vertical"):
        duplicate = seed % 2
        pairs = [(n, k), (n + 1, k + 2), (n if duplicate else n + 2, k + 1)]
        if key == "unique-output":
            return make(
                f"Do the pairs {', '.join(map(str,pairs))} define a function?",
                "no" if duplicate else "yes",
                "Group the outputs by input.",
                f"x = {n} → {k}" + (f", {k+1}" if duplicate else ""),
                "Check how many outputs each input has.",
                "two for one input" if duplicate else "one per input",
                choices=["yes", "no"],
            )
        return make(
            f"A graph consists of {', '.join(map(str,pairs))}. How many of these points does x = {n} hit?",
            1 + duplicate,
            "Hold the horizontal coordinate fixed.",
            f"x = {n}",
            "Count the listed points with that coordinate.",
            f"y = {k}" + (f", {k+1}" if duplicate else ""),
        )
    if key == "function-rule":
        return make(
            f"A machine uses f(x) = {k}x − {n}. What is f({sign*k})?",
            k * k * sign - n,
            "Replace the input with its given value.",
            f"{k} × ({sign*k}) − {n}",
            "Multiply before subtracting.",
            f"{k*k*sign} − {n}",
        )
    if key == "compare-rate":
        return make(
            f"A follows y = {n}x + 4. B passes through (1, 3) and (3, {3+2*(n+k)}). How much greater is B's slope?",
            k,
            "Divide B's rise by its run.",
            f"{2*(n+k)} ÷ 2 = {n+k}",
            "Subtract the coefficient of x in A.",
            f"{n+k} − {n}",
        )
    if key == "compare-start":
        return make(
            f"A starts at y = {n+k} when x = 0. B follows y = {k}x + {n}. Find A's initial advantage.",
            k,
            "Read B's value at input zero.",
            f"{k} × 0 + {n} = {n}",
            "Subtract B's start from A's start.",
            f"{n+k} − {n}",
        )
    if key == "interval":
        delta = [k, 0, -k][seed % 3]
        ans = ["increasing", "constant", "decreasing"][seed % 3]
        return make(
            f"On a straight graph segment between minutes {n} and {n+2}, depth goes from {n+k} to {n+k+delta} cm. Describe that interval.",
            ans,
            "Compute the output change as time increases.",
            f"{n+k+delta} − {n+k} = {delta}",
            "Use the sign of that change.",
            f"{delta} " + (" > 0" if delta > 0 else " < 0" if delta < 0 else "= 0"),
            choices=["increasing", "constant", "decreasing"],
        )
    if key in ("write-both", "write-bound"):
        exact = key == "write-both"
        relation = "=" if exact else "≤"
        prompt = f"A charges ${n} plus ${k} per visit. B charges ${n+k+2} plus ${k-1} per visit. Model A costing {'the same as' if exact else 'at most as much as'} B for x visits."
        left = f"{n} + {k}x"
        right = f"{n+k+2} + {k-1}x"
        return make(
            prompt,
            f"{left} {relation} {right}",
            "Write each bill as fee plus rate times visits.",
            left + " and " + right,
            "Place the comparison between the two bills.",
            f"A {relation} B",
            choices=[
                f"{left} {'>' if exact else '≥'} {right}",
                f"{n}x + {k} {relation} {right}",
            ],
        )
    if key == "collect":
        return make(
            f"Solve {k+2}x + {k} = {k}x + {2*n+k}.",
            n,
            "Subtract matching variable terms from both sides.",
            f"2x + {k} = {2*n+k}",
            "Subtract the constant, then divide by two.",
            f"2x = {2*n}",
        )
    if key == "distribute-both":
        return make(
            f"Solve {k+1}(x + 2) = {k}(x + 1) + {n+k+2}.",
            n,
            "Distribute each coefficient.",
            f"{k+1}x + {2*k+2} = {k}x + {n+2*k+2}",
            "Remove matching terms and constants.",
            f"x = {n+2*k+2} − {2*k+2}",
        )
    if key == "fraction-coeff":
        return make(
            f"Solve x/2 + {n} = x/4 + {n+k}.",
            4 * k,
            "Subtract one quarter of x and the constant.",
            f"x/4 = {k}",
            "Multiply by the denominator.",
            f"x = 4 × {k}",
        )
    if key == "both-bound":
        bound = sign * n
        return make(
            f"Find the {'greatest' if seed%2 else 'least'} allowed integer x for {k+1}x + {k} {'≤' if seed%2 else '≥'} {k}x + {bound+k}.",
            bound,
            "Subtract the common variable terms.",
            f"x + {k} {'≤' if seed%2 else '≥'} {bound+k}",
            "Subtract the constant; equality is allowed.",
            f"x {'≤' if seed%2 else '≥'} {bound}",
        )
    if key == "one-solution":
        if seed % 3 == 0:
            return make(
                f"Find the unique solution of {k+1}x + {n} = {k}x + {n+k}.",
                k,
                "Collect the variable terms.",
                f"x + {n} = {n+k}",
                "Subtract the constant.",
                f"x = {n+k} − {n}",
            )
        if seed % 3 == 1:
            return make(
                f"Which value of c gives exactly one solution in cx + {n} = {k}x + {n+1}?",
                k + 1,
                "Collect the variables.",
                "(c − " + str(k) + ")x = 1",
                "The coefficient must be nonzero.",
                f"c ≠ {k}",
                choices=[k],
            )
        return make(
            f"How many solutions does {k+1}x + {n} = {k}x + {n+k} have?",
            1,
            "Subtract the right-hand variable term.",
            f"x + {n} = {n+k}",
            "A nonzero coefficient determines one value.",
            f"x = {k}",
        )
    if key == "contradiction":
        if seed % 3 == 0:
            return make(
                f"After cancelling x terms in {k}(x + {n}) = {k}x + {k*n+n}, by how much do the constants differ?",
                n,
                "Distribute on the left.",
                f"{k}x + {k*n}",
                "Subtract the smaller constant from the larger.",
                f"{k*n+n} − {k*n}",
            )
        if seed % 3 == 1:
            return make(
                f"Which constant c makes {k}(x + {n}) = {k}x + c impossible?",
                k * n + 1,
                "Expand both sides and cancel the x terms.",
                f"{k*n} = c",
                "Choose a different value to get a contradiction.",
                f"{k*n} ≠ {k*n+1}",
                choices=[k * n],
            )
        return make(
            f"How many solutions does {k}(x + {n}) = {k}x + {k*n+1} have?",
            0,
            "Expand the left side.",
            f"{k}x + {k*n}",
            "Cancel matching variable terms and test the claim.",
            f"{k*n} ≠ {k*n+1}",
        )
    if key == "identity":
        return make(
            f"Choose c so that {k}(x + {n}) = {k}x + c holds for every x.",
            k * n,
            "Distribute to both terms.",
            f"{k}x + {k} × {n}",
            "Match the constant terms.",
            f"c = {k} × {n}",
        )
    if key == "common-point":
        y0 = n + k
        extra = seed % 2
        return make(
            f"Does ({n}, {y0}) solve both y = x + {k} and y = 2x + ({k-n+extra})?",
            "no" if extra else "yes",
            "Substitute the given x into the first line.",
            f"{n} + {k} = {y0}",
            "Check the same point in the second line.",
            f"{2*n} + ({k-n+extra}) = {y0+extra}",
            choices=["yes", "no"],
        )
    if key == "graph-cross":
        slope, intercept = 1 + seed % 4, seed // 4 % 4
        y = slope * n + intercept
        rule = ("x" if slope == 1 else f"{slope}x") + (f" + {intercept}" if intercept else "")
        pts = [[0, y], [2 * n, y], [0, intercept], [2 * n, 2 * n * slope + intercept]]
        prompt = f"Read the intersection of y = {y} and y = {rule}."
        _, clip = make(prompt, n,
                       "Read y on the horizontal line.", f"y = {y}",
                       "Check both rules at the crossing.", f"{slope} × {n} + {intercept} = {y}")
        clip["result"] = clip["answer"] = f"({n}, {y})"
        row = fields(prompt, ["x at the intersection", f"y-value on y = {y} at that x", f"y-value on y = {rule} at that x"],
                     [n, y, y], [[n - 1, n + 1], [y - 1, y + 1], [y - 1, y + 1]],
                     seed, dict(kind="intersection", points=pts), kind="record")
        return row, clip
    if key == "interpret-cross":
        return make(
            f"Two fares match at ({n}, {n*k}) on a graph of dollars versus miles. What is the common cost in dollars?",
            n * k,
            "The horizontal coordinate gives distance.",
            f"x = {n} miles",
            "Read the vertical coordinate for cost.",
            f"y = {n*k}",
        )
    if key == "substitute":
        return make(
            f"Solve y = x + {k} and x + y = {2*n+k}. Find y.",
            n + k,
            "Replace y in the sum using the first equation.",
            f"2x + {k} = {2*n+k}",
            "Use the resulting x in the first equation.",
            f"y = {n} + {k}",
        )
    if key == "eliminate":
        return make(
            f"Solve x + y = {n+k} and x − y = {n-k}. Find x.",
            n,
            "Add the equations so y cancels.",
            f"2x = {n+k} + ({n-k})",
            "Divide the sum by two.",
            f"x = {2*n}/2",
        )
    if key == "scale-eliminate":
        return make(
            f"Solve x + y = {n+k} and 3x + 2y = {3*n+2*k}. Find x.",
            n,
            "Double the first equation.",
            f"2x + 2y = {2*(n+k)}",
            "Subtract it from the second equation.",
            f"x = {3*n+2*k} − {2*(n+k)}",
        )

    if key == "leg-squares":
        return make(
            f"A right triangle has legs {n} and {k}. Find the area of the square on its hypotenuse.",
            n * n + k * k,
            "Square each leg length.",
            f"{n}² = {n*n}, {k}² = {k*k}",
            "Add the two leg-square areas.",
            f"{n*n} + {k*k}",
            visual=dict(kind="pythagorean", labels=[str(n * n), str(k * k), "?"]),
        )
    if key == "dissection":
        return make(
            f"Four right triangles with legs {n} and {k} fit in a square of side {n+k}, surrounding a central square. Find its area.",
            n * n + k * k,
            "Find the large square's area.",
            f"{n+k}² = {(n+k)**2}",
            "Subtract the four half-rectangles.",
            f"{(n+k)**2} − 2 × {n} × {k}",
        )
    if key == "recover-leg-area":
        return make(
            f"The square on a hypotenuse has area {n*n+k*k}. One leg-square has area {k*k}. Find the other leg-square area.",
            n * n,
            "Use the area relationship.",
            "a² + b² = c²",
            "Subtract the known area.",
            f"{n*n+k*k} − {k*k}",
        )
    leg1, leg2, hyp = ([3, 4, 5], [5, 12, 13], [8, 15, 17])[seed % 3]
    u, w, h = leg1 * n, leg2 * n, hyp * n
    if key == "hypotenuse":
        return make(
            f"A right triangle has legs {u} and {w}. Find the hypotenuse.",
            h,
            "Add the squared leg lengths.",
            f"{u}² + {w}² = {h*h}",
            "Take the positive square root.",
            f"√{h*h}",
        )
    if key == "missing-leg":
        return make(
            f"A ladder of length {h} reaches a wall from {u} units away on level ground. How high does it reach?",
            w,
            "Subtract the horizontal leg squared from the hypotenuse squared.",
            f"{h}² − {u}² = {w*w}",
            "Take the positive square root.",
            f"√{w*w}",
        )
    if key == "converse":
        c = h + seed % 2
        return make(
            f"Can side lengths {u}, {w}, {c} form a right triangle?",
            "no" if seed % 2 else "yes",
            "Add the squares of the two shorter sides.",
            f"{u}² + {w}² = {h*h}",
            "Compare with the largest side squared.",
            f"{c}² = {c*c}",
            choices=["yes", "no"],
        )
    if key == "displacements":
        return make(
            f"From (−{k}, {n}) to ({n}, {n-k}), find the {'vertical' if seed%2 else 'horizontal'} distance.",
            k if seed % 2 else n + k,
            "Subtract the starting coordinate on the requested axis.",
            f"{n-k} − {n}" if seed % 2 else f"{n} − (−{k})",
            "Take the absolute value.",
            f"abs({-k if seed%2 else n+k})",
        )
    if key == "point-distance":
        x, y = -1 - seed // 3, k - 5
        dx, dy, distance = DISTANCE_OFFSETS[seed % 3]
        return make(
            f"Find the distance from ({x}, {y}) to ({x+dx}, {y+dy}).",
            distance,
            "Find the horizontal and vertical distances.",
            f"{abs(dx)} and {abs(dy)}",
            "Take the square root of their squared sum.",
            f"√({dx*dx} + {dy*dy})",
        )
    if key == "radical-distance":
        return make(
            f"Points (0, 0) and ({n}, 1) are √m units apart. Find the radicand m.",
            n * n + 1,
            "Square the two displacements.",
            f"{n}² and 1²",
            "Add under the radical.",
            f"m = {n*n} + 1",
        )
    if key == "base-area":
        return make(
            f"A cylinder has diameter {2*n} cm. Find the coefficient of π in its base area.",
            n * n,
            "Halve the diameter to get the radius.",
            f"r = {2*n}/2 = {n}",
            "Square the radius in the circle area formula.",
            f"A = {n}²π",
        )
    if key == "stack-base":
        return make(
            f"A cylinder has base area {n}π cm² and height {k} cm. Its volume is how many times π cm³?",
            n * k,
            "Each unit of height adds one base-area layer.",
            f"B = {n}π",
            "Multiply base area by height.",
            f"{n}π × {k}",
        )
    if key == "cylinder-height":
        return make(
            f"A cylinder's volume is {k*k*n}π m³ and its radius is {k} m. Find its height in meters.",
            n,
            "Square the radius for the base area.",
            f"B = {k*k}π",
            "Divide volume by base area.",
            f"{k*k*n} ÷ {k*k}",
        )
    if key == "third":
        return make(
            f"A cylinder holds {3*(10*n+k)} mL. What is the capacity of a cone with the same base and height?",
            10 * n + k,
            "Three matching cones fill the cylinder.",
            "3 cones = 1 cylinder",
            "Divide its capacity by three.",
            f"{3*(10*n+k)} ÷ 3",
        )
    if key == "cone-volume":
        return make(
            f"A cone has radius {k} and height {3*n}. Find the coefficient of π in its volume.",
            k * k * n,
            "Calculate the matching cylinder coefficient.",
            f"{k}² × {3*n} = {k*k*3*n}",
            "A cone occupies one third as much.",
            f"{k*k*3*n} ÷ 3",
        )
    if key == "cone-height":
        return make(
            f"A cone has base area {k}π and volume {n*k}π. Find its height.",
            3 * n,
            "Multiply its volume by three.",
            f"Bh = {3*n*k}π",
            "Divide by the base area.",
            f"{3*n*k} ÷ {k}",
        )
    if key == "sphere-cube":
        return make(
            f"For radius {n}, find r³ in the sphere formula V = 4πr³/3.",
            n**3,
            "Square the radius.",
            f"{n}² = {n*n}",
            "Multiply by the radius once more.",
            f"{n*n} × {n}",
        )
    if key == "sphere-diameter":
        radius = 1 + seed % 5
        count = 1 + seed // 5
        prompt = (f"A sphere has diameter {2*radius} cm. Give the coefficient of π in its volume as a simplified number."
                  if count == 1 else f"Each of {count} identical spheres has diameter {2*radius} cm. Give the coefficient of π in their combined volume.")
        return make(
            prompt,
            F(4 * count * radius**3, 3),
            "Convert diameter to radius.",
            f"r = {2*radius}/2 = {radius}",
            "Multiply the cubed radius by four thirds." if count == 1 else "Multiply the cubed radius by four thirds and by the number of spheres.",
            f"4 × {radius**3}/3" if count == 1 else f"4 × {radius**3} × {count}/3",
        )
    if key == "sphere-scale":
        return make(
            f"One sphere has radius {n} and another radius {n*k}. How many times as large is the second volume?",
            k**3,
            "Compare radii.",
            f"{n*k}/{n} = {k}",
            "Cube the radius ratio.",
            f"{k}³",
        )
    if key == "prism-lateral":
        return make(
            f"A right prism has rectangular base {n} by {k} cm and height {k+1} cm. Find its lateral area in cm².",
            2 * (n + k) * (k + 1),
            "Find the base perimeter.",
            f"2 × ({n} + {k}) = {2*(n+k)}",
            "Multiply the perimeter by prism height.",
            f"{2*(n+k)} × {k+1}",
        )
    if key == "unwrap":
        return make(
            f"A cylinder of diameter {2*n} cm is unrolled. Its wrap width is wπ cm. Find w.",
            2 * n,
            "The wrap follows one complete circle.",
            "width = circumference",
            "Use the diameter form of circumference.",
            f"width = {2*n}π",
        )
    if key == "side-wrap":
        return make(
            f"A cylinder of radius {n} and height {k} needs a label covering just its side. Find its area divided by π.",
            2 * n * k,
            "The label width equals the circumference.",
            f"width = {2*n}π",
            "Multiply by label height.",
            f"{2*n}π × {k}",
        )
    if key == "caps":
        ends = 1 + seed % 2
        return make(
            f"A cylinder of radius {k} and height {n} needs covering on its side and {ends} circular end(s). Find the total area divided by π.",
            2 * k * n + ends * k * k,
            "Compute side area divided by π.",
            f"2 × {k} × {n} = {2*k*n}",
            "Add the covered circular ends.",
            f"{2*k*n} + {ends} × {k*k}",
        )
    if key == "pair":
        sx, sy = (-1 if seed % 4 in (1, 2) else 1), (-1 if seed % 4 in (2, 3) else 1)
        observations = [(sx * x, sy * y) for x, y in [(a, b), (a + 2, b + k % 3), (a + 4, b + 2)]]
        row = scatter_task(observations)
        pairs = ", ".join(f"({x}, {y})" for x, y in observations)
        _, clip = make(f"Make a scatterplot from {pairs}.", 3,
                       "Place each x and its paired y as one dot.", pairs,
                       "There is one dot per row. Leave them unconnected.", "3 dots")
        clip["answer"] = clip["result"] = "3 dots"
        return row, clip
    if key == "association":
        patterns = [[1, 3, 2, 5, 7], [7, 5, 6, 3, 1], [3, 6, 1, 6, 3]]
        pattern = seed % 3
        coords = [[i + 1, n + v] for i, v in enumerate(patterns[pattern])]
        answer = ["positive", "negative", "no clear linear association"][pattern]
        return make(
            "Describe the linear association in this scatterplot.",
            answer,
            "Read y from left to right.",
            ", ".join(str(p[1]) for p in coords),
            "Look for an overall rise or fall.",
            ["mostly rises", "mostly falls", "no overall rise or fall"][pattern],
            choices=["positive", "negative", "no clear linear association"],
            visual=dict(kind="scatter", points=coords),
            caption=f"For increasing x, y is {', '.join(str(p[1]) for p in coords)}. Describe the linear association.",
        )
    if key == "outlier":
        coords = [[1, n + 1], [2, n + 2], [3, n + 3], [4, n + 4], [5, n + 5]]
        idx = seed % 5
        coords[idx][1] += 8
        return make(
            "Four points follow the same straight line. Give the x-coordinate of the outlier.",
            idx + 1,
            "Compare the points with the main pattern.",
            f"y = x + {n}",
            "Find the observation above that line.",
            f"({idx+1}, {coords[idx][1]})",
            visual=dict(kind="scatter", points=coords),
            caption=f"Most points follow y = x + {n}. Which x is the outlier: {', '.join(f'({x},{y})' for x,y in coords)}?",
        )
    if key == "trend-slope":
        return make(
            f"A fitted line passes through (2, {n}) and ({k+2}, {n+sign*k*k}). Estimate its slope.",
            sign * k,
            "Find the change in predicted y.",
            f"{n+sign*k*k} − {n} = {sign*k*k}",
            "Divide by the change in x.",
            f"{sign*k*k} ÷ {k}",
        )
    if key == "predict":
        return make(
            f"A fitted line estimates height in cm by h = {k}d + {n}. Predict the height on day {k+2}.",
            k * (k + 2) + n,
            "Substitute the given day.",
            f"h = {k} × {k+2} + {n}",
            "Add the initial height after multiplying.",
            f"{k*(k+2)} + {n}",
        )
    if key == "residual":
        return make(
            f"A model predicted {n+k} minutes. The actual time was {n+k+sign*k}. Find actual minus predicted.",
            sign * k,
            "Start with the observed value.",
            f"observed = {n+k+sign*k}",
            "Subtract the predicted value, keeping the sign.",
            f"{n+k+sign*k} − {n+k}",
        )
    if key == "deviation":
        return make(
            f"A test score is {n+k+sign*k} and the group mean is {n+k}. Find the absolute deviation.",
            k,
            "First find the signed difference.",
            f"{n+k+sign*k} − {n+k} = {sign*k}",
            "Take its distance from zero.",
            f"abs({sign*k})",
        )
    if key == "mean-deviation":
        return make(
            f"Find the MAD of {n-k}, {n}, and {n+k}.",
            F(2 * k, 3),
            "Find the mean and each absolute distance.",
            f"mean = {n}, distances {k}, 0, {k}",
            "Average all three distances.",
            f"({k} + 0 + {k})/3",
        )
    if key == "compare-mad":
        return make(
            f"Groups A and B both average {n}. A has two values {n-1}, {n+1}. B has {n-k}, {n+k}. How much greater is B's MAD?",
            k - 1,
            "A's two distances from the mean are one.",
            "MAD = 1",
            "B's two distances are equal; subtract A's MAD.",
            f"{k} − 1",
        )
    if key == "sample-estimate":
        return make(
            f"A random sample of 40 finds {n} walkers. About how many walkers would you expect among {40*k} students?",
            n * k,
            "Scale the sample size to the population.",
            f"{40*k} ÷ 40 = {k}",
            "Scale the observed count by the same factor.",
            f"{n} × {k}",
        )
    if key == "sample-spread":
        low_small, high_small = 10 * (seed % 4 + 1), 10 * (seed % 4 + 5 + seed // 8)
        low_large, high_large = low_small + 2 * k, high_small - 2 * (k + 1 + seed % 2)
        small_spread, large_spread = high_small - low_small, high_large - low_large
        return make(
            f"With samples of 10, estimates span {low_small}%–{high_small}%. With samples of 50, they span {low_large}%–{high_large}%. How much narrower is the second range, in percentage points?",
            small_spread - large_spread,
            "Subtract the endpoints of each range.",
            f"{small_spread} and {large_spread}",
            "Compare the two widths.",
            f"{small_spread} − {large_spread}",
        )
    if key in ("joint", "marginal", "conditional"):
        rowtotal = 40
        a1 = n
        a2 = rowtotal - n
        b1 = k
        b2 = k + 1
        vis = table(["Route", "Bike", "Bus"], [("North", a1, a2), ("South", b1, b2)])
        caption = f"North has {a1} bike and {a2} bus riders. South has {b1} bike and {b2} bus riders."
        if key == "joint":
            north = seed % 2 == 0
            prompt = f"How many students are both on the {'North' if north else 'South'} route and riding the {'bus' if north else 'bike'}?"
            return make(
                prompt,
                a2 if north else b1,
                "Choose the row for the route.",
                "north" if north else "south",
                "Read the count in the requested column.",
                f"bus = {a2}" if north else f"bike = {b1}",
                visual=vis,
                caption=caption + " " + prompt,
            )
        if key == "marginal":
            prompt = "How many students bike across both routes?"
            return make(
                prompt,
                a1 + b1,
                "Choose both cells in the bike column.",
                f"{a1} and {b1}",
                "Add the two counts.",
                f"{a1} + {b1}",
                visual=vis,
                caption=caption + " " + prompt,
            )
        prompt = "Of the North-route students, what percent ride a bike?"
        return make(
            prompt,
            F(100 * a1, 40),
            "Use only North-route students in the denominator.",
            f"{a1} + {a2} = 40",
            "Convert the within-row share to a percent.",
            f"100 × {a1}/40",
            visual=vis,
            decimal=True,
            caption=caption + " " + prompt,
        )
    if key == "repayment":
        months = 12 * (1 + seed % 3)
        payment = 20 + n
        return make(
            f"A loan is repaid in {months} monthly payments of ${payment} with no other charges. Find total repayment.",
            months * payment,
            "Count all scheduled payments.",
            f"{months} months",
            "Multiply by the payment amount.",
            f"{months} × {payment}",
        )
    if key == "loan-cost":
        principal = 100 * n
        interest = 12 * k
        fee = n + k
        return make(
            f"Payments total ${principal+interest} on a ${principal} loan, plus a separate ${fee} fee. What is the cost above principal?",
            interest + fee,
            "Subtract principal from scheduled payments.",
            f"{principal+interest} − {principal} = {interest}",
            "Add the separate fee once.",
            f"{interest} + {fee}",
        )
    if key == "loan-compare":
        return make(
            f"For the same loan, A requires 12 payments of ${2*n+k}. B requires 24 of ${n}. With no fees, how many dollars less does B cost?",
            12 * k,
            "Multiply each payment by its count.",
            f"A = {12*(2*n+k)}, B = {24*n}",
            "Subtract the lower total.",
            f"{12*(2*n+k)} − {24*n}",
        )
    if key == "deposits":
        months = 2 + seed % 11
        return make(
            f"A saver starts with ${n*10} and adds ${k*10} each month for {months} months. How much of the final balance comes from money deposited, including the initial amount?",
            n * 10 + k * 10 * months,
            "Total the monthly deposits.",
            f"{months} × {k*10}",
            "Include the starting deposit.",
            f"{months*k*10} + {n*10}",
        )
    if key == "grow-deposit":
        return make(
            f"Deposit ${100*n} at the start of a year. It grows {k}% before a ${50*n} year-end deposit. Find the balance immediately after that deposit.",
            150 * n + n * k,
            "Earn growth only on the first deposit.",
            f"{100*n} × {k}/100 = {n*k}",
            "Add growth and both deposits.",
            f"{100*n} + {n*k} + {50*n}",
        )
    if key == "investment-gain":
        return make(
            f"A saver contributes ${n*100} initially and ${k*10} in each of 12 months. The final balance is ${n*100+12*k*10+5*n}. How much came from growth?",
            5 * n,
            "Add all contributions.",
            f"{n*100} + 12 × {10*k} = {100*n+120*k}",
            "Subtract deposits from the final balance.",
            f"{100*n+120*k+5*n} − {100*n+120*k}",
        )
    if key == "debit":
        return make(
            f"Checking has ${10*n+k}. A debit purchase of ${n} posts along with a ${k} fee. What balance remains?",
            9 * n,
            "Combine the amounts leaving checking.",
            f"{n} + {k} = {n+k}",
            "Subtract that total from the opening balance.",
            f"{10*n+k} − {n+k}",
        )
    if key == "credit":
        return make(
            f"An unpaid balance of ${100*n} incurs {k}% interest for one period plus a ${k+2} fee. How many dollars are added?",
            n * k + k + 2,
            "Compute one period's interest.",
            f"{100*n} × {k}/100 = {n*k}",
            "Add the stated fee.",
            f"{n*k} + {k+2}",
        )
    if key == "payment-risk":
        balance = n * 10
        purchase = balance + (k if seed % 2 else -k)
        return make(
            f"A student buys an item for ${purchase} with ${balance} in checking. If the debit goes through, would the balance be negative?",
            "yes" if purchase > balance else "no",
            "Subtract the debit from available funds.",
            f"{balance} − {purchase} = {balance-purchase}",
            "A balance below zero is overdrawn.",
            f"{balance-purchase} {'<' if purchase>balance else '>'} 0",
            choices=["yes", "no"],
        )
    if key == "cost-budget":
        return make(
            f"A term has ${100*n} tuition, ${k*10} in books and {k} months of travel at ${n} per month. Find the total.",
            100 * n + k * 10 + k * n,
            "Multiply the monthly cost by the number of months.",
            f"{k} × {n} = {k*n}",
            "Add each one-time cost once.",
            f"{100*n} + {k*10} + {k*n}",
        )
    if key == "grant-gap":
        return make(
            f"A term costs ${500*n}. Grants cover ${200*n} and savings cover ${k*20}. How many dollars are still needed?",
            300 * n - k * 20,
            "Combine the available funds.",
            f"{200*n} + {20*k} = {200*n+20*k}",
            "Subtract them from the term cost.",
            f"{500*n} − {200*n+20*k}",
        )
    if key == "monthly-goal":
        return make(
            f"A student needs ${k*n*10+100} in {k} months and already has $100. With no interest, find the required monthly deposit.",
            n * 10,
            "Subtract existing savings from the goal.",
            f"{k*n*10+100} − 100 = {k*n*10}",
            "Divide the gap into equal monthly deposits.",
            f"{k*n*10} ÷ {k}",
        )
    raise ValueError(key)


def problem(key, seed):
    return activity(key, seed)[0]


def worked_example(key):
    return activity(key, 2 if key == "sphere-diameter" else 25)[1]
