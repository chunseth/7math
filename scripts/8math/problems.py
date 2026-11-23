"""Three practice forms per lesson. Eight configurations per form make a 24-item pool."""

from fractions import Fraction as F
from math import sqrt, pi
from random import Random
from formats import q, choose, grid, table, fields, item, tenth_line, scatter_task


def image_triangle(before, after, action):
    vertices = ", ".join(f"{label}({x}, {y})" for label, (x, y) in zip("ABC", before))
    return item(
        f"{action} The vertices are {vertices}. Plot A′, B′, C′ in that order.",
        ";".join(f"{x},{y}" for x, y in after), dict(kind="graph", limit=10, points=3),
    )


def problem(slug, seed):
    n, v = 2 + seed // 3, seed % 3
    k = 2 + (5 * n + v) % 7

    def choice(prompt, answer, alternatives, visual=None):
        return choose(prompt, answer, alternatives, seed + n, visual)

    def point(prompt, x, y):
        return grid(prompt, x, y, max(10, abs(x), abs(y)))

    def decimal(prompt, value, places=None):
        return q(prompt, value, "decimal", places=places)

    if slug == "repeat":
        block = 10 + n if v == 1 else n
        if v == 0:
            return q(
                f"Write 0.{n}{n}{n}… as a fraction in lowest terms.",
                F(n, 9),
                "fraction",
            )
        if v == 1:
            return q(
                f"Write 0.{block}{block}{block}… as a simplified fraction.",
                F(block, 99),
                "fraction",
            )
        return q(
            f"Write {n}.3333… as an improper fraction.", F(3 * n + 1, 3), "fraction"
        )
    if slug == "powers":
        if v == 0:
            return q(
                f"Write {n} to the power −2 as a simplified fraction.",
                F(1, n * n),
                "fraction",
            )
        if v == 1:
            return q(f"Simplify x^{n} × x^{k} as x^e. Find e.", n + k)
        return q(f"For nonzero a, (a^{n})³ ÷ a^{n+1} = a^e. Find e.", 2 * n - 1)
    if slug == "scientific-ops":
        if v == 0:
            return q(
                f"A sensor processes {n} × 10⁵ bytes each second. In 0.01 seconds how many bytes?",
                1000 * n,
            )
        if v == 1:
            return q(
                f"A distance of {n} × 10⁶ m is how many times as long as 2 × 10³ m?",
                500 * n,
            )
        return q(
            f"In scientific notation, ({n} × 10^{n+1}) × (5 × 10⁴) has what exponent after normalizing?",
            n + 6,
        )
    if slug == "compose":
        a, b = n - 5, n - 6
        if v == 0:
            return point(
                f"Reflect ({a}, {b}) across the y-axis and then translate 3 right and 1 down. Plot the image.",
                3 - a,
                b - 1,
            )
        if v == 1:
            return point(
                f"Translate ({a}, {b}) up 2, then rotate 90° counterclockwise about the origin. Plot the image.",
                -b - 2,
                a,
            )
        return choice(
            f"A triangle with a {n} cm side rotates 90° and dilates by 2. Which describes the image?",
            f"Similar, with a {2*n} cm matching side",
            ["Congruent with reversed orientation", "Different interior angles"],
        )
    if slug == "compare-functions":
        if v == 0:
            return q(
                f"A has rule y = {n}x + 3. By how much does B's slope exceed A's?",
                2,
                visual=table(["x", "B"], [(0, 1), (1, n + 3), (2, 2 * n + 5)]),
            )
        if v == 1:
            return choice(
                f"A square's side grows from {n} to {n+2} in unit steps. How does its area change?",
                "It increases at an increasing rate",
                ["It increases at a constant rate", "It decreases"],
            )
        return item(
            f"Sketch a trip that starts at distance 0, travels to {n} km by hour 1, then waits through hour 2. Plot its three vertices in time order.",
            f"0,0;1,{n};2,{n}",
            dict(kind="graph", points=3, limit=10),
        )
    if slug == "solutions":
        lhs = f"{n}(x + 2)"
        rhs = [f"{n}x + {2*n}", f"{n}x + {2*n+1}", f"{n+1}x + {n}"][v]
        opts = ["Infinitely many", "None", "One"]
        return choice(f"How many solutions does {lhs} = {rhs} have?", opts[v], opts)
    if slug == "system-algebra":
        if v == 0:
            return q(
                f"Given x + y = {3*n} and x − y = {n}, use elimination to find x.",
                2 * n,
            )
        if v == 1:
            return q(
                f"If y = x + {n} and x + y = {5*n}, find y by substitution.", 3 * n
            )
        return q(
            f"A stand sells {3*n} tickets for ${8*n}. Adult tickets cost $3 and child tickets $2. How many adult tickets were sold?",
            2 * n,
        )
    if slug == "two-way":
        vis = table(
            ["Travel", "Packed lunch", "Bought lunch"],
            [["Bus", 3 * n, 2 * n], ["Walk", 2 * n, 3 * n]],
        )
        if v == 0:
            return q("What percent of bus riders packed lunch?", 60, visual=vis)
        if v == 1:
            return q(
                "How many students walked, plus how many bus riders bought lunch?",
                7 * n,
                visual=vis,
            )
        return choice(
            "Which group has the greater proportion of packed lunches?",
            "Bus riders",
            ["Walkers", "The proportions match"],
            vis,
        )
    if slug == "sets":
        value, label = [
            (f"−{n}", "Integer"),
            (f"{n}/{n+1}", "Rational"),
            (f"√{n*n+1}", "Irrational"),
        ][v]
        return choice(
            f"Which is the smallest listed number set containing {value}?",
            label,
            ["Whole", "Integer", "Rational", "Irrational"],
            dict(kind="sets", labels=["Real", "Rational", "Integer", "Whole"]),
        )
    if slug == "roots":
        if v == 0:
            return q(f"What is the positive square root of {n*n}?", n)
        if v == 1:
            return q(f"A cube has volume {n**3} cm³. Find its edge in cm.", n)
        return choice(
            f"Which two consecutive integers enclose √{n*n+n}?",
            f"{n} and {n+1}",
            [f"{n-1} and {n}", f"{n+1} and {n+2}"],
        )
    if slug == "estimate":
        m = n * n + (1, n, 2 * n)[v]
        if v == 0:
            return tenth_line(f"Mark √{m} to the nearest tenth on the number line.", round(sqrt(m) * 10))
        if v == 1:
            return q(
                f"What integer lies immediately to the left of −√{m} on a number line?",
                -n - 1,
            )
        return tenth_line(f"Mark {n}π to the nearest tenth on the number line.", round(n * pi * 10))
    if slug == "order":
        low, mid, high = f"{n}.05", f"√{n*n+n}", f"{n}.9"
        if v == 0:
            return choice(
                f"Order three lengths from shortest to longest: {mid}, {high}, {low}.",
                f"{low}, {mid}, {high}",
                [f"{mid}, {low}, {high}", f"{high}, {mid}, {low}"],
            )
        if v == 1:
            return choice(
                f"Which elevation is lowest: −{mid}, −{low}, or −{high}?",
                f"−{high}",
                [f"−{mid}", f"−{low}"],
            )
        return choice(
            f"Which race time is between {low} s and {high} s?",
            mid,
            [str(n), str(n + 1)],
        )
    if slug == "scientific":
        power = (n % 5) + 2
        if v == 0:
            return q(
                f"Write {n}.2 × 10^{power} as an ordinary number.",
                (10 * n + 2) * 10 ** (power - 1),
            )
        if v == 1:
            return q(
                f"The number {float(F(n,10**power)):.{power}f} equals {n} × 10^e. Find e.",
                -power,
            )
        return choice(
            f"Which normalized scientific notation equals {n*13000:,}?",
            f"{n*13000/10**(len(str(n*13000))-1):g} × 10^{len(str(n*13000))-1}",
            [f"{n}.3 × 10^2", f"{n}.3 × 10^6"],
        )
    if slug == "similar":
        if v == 0:
            return q(
                f"A side of {2*n} cm becomes {3*n} cm. Its matching neighbor is {2*n+2} cm originally. Find its new length.",
                3 * (n + 1),
            )
        if v == 1:
            return q(
                f"A model is one fifth of the actual length. A model beam is {n} cm. Actual cm?",
                5 * n,
            )
        return q(
            f"Similar triangles have corresponding sides {n} and {3*n}. A second side of the larger is {6*n} cm. Find its partner.",
            2 * n,
        )
    if slug == "dilate":
        if v == 0:
            x, y = n % 5 - 2, n // 5 - 2
            triangle = [(x, y), (x + 2, y), (x, y + 1)]
            return image_triangle(triangle, [(2 * a, 2 * b) for a, b in triangle], "Dilate triangle ABC by a factor of 2 about the origin.")
        x, y = [(n, -2), (-2 * n, 4), (n, 2 * n)][v]
        factor = F(1, 2) if v == 1 else F(3)
        if max(abs(x * factor), abs(y * factor)) > 10:
            return fields(
                f"Dilate ({x}, {y}) by {factor} about the origin. Give the image coordinates.",
                ["x", "y"],
                [int(x * factor), int(y * factor)],
                [[x, x + 1], [y, y + 1]],
                seed,
                kind="record",
            )
        return point(
            f"Plot the image of ({x}, {y}) under dilation by {factor} about (0, 0).",
            int(x * factor),
            int(y * factor),
        )
    if slug == "scale-area":
        if v == 0:
            return q(
                f"A polygon of area {n} cm² is dilated by 3. Find the image area in cm².",
                9 * n,
            )
        if v == 1:
            return q(
                f"A perimeter of {4*n} m is dilated by 1/2. Find the image perimeter.",
                2 * n,
            )
        return q(
            f"A square's original area is {n*n} cm². Its image area is {4*n*n} cm². Find the positive linear scale factor.",
            2,
        )
    if slug == "translate":
        x, y = n - 5, 6 - n
        if v == 0:
            return point(
                f"Translate ({x}, {y}) left 2 and up 3. Plot the image.", x - 2, y + 3
            )
        if v == 1:
            return point(
                f"Reflect ({x}, {y}) across the x-axis. Plot the image.", x, -y
            )
        return point(f"Reflect ({x}, {y}) across the y-axis. Plot the image.", -x, y)
    if slug == "rotate":
        x, y = n, 2 - n
        deg = [90, 180, 270, 360][seed % 4]
        p = (x, y) if x < 9 else (-x, y)
        triangle = [p, (p[0] + 1, p[1]), (p[0], p[1] + 2)]
        image = [{90: (-b, a), 180: (-a, -b), 270: (b, -a), 360: (a, b)}[deg] for a, b in triangle]
        return image_triangle(triangle, image, f"Rotate triangle ABC {deg}° counterclockwise about the origin.")
    if slug == "rigid":
        if v == 0:
            return choice(
                f"A triangle with perimeter {3*n} cm is translated {n} cm east. How do size and clockwise vertex order change?",
                "Both stay the same",
                ["Only size changes", "Only order reverses"],
            )
        if v == 1:
            return choice(
                f"A clockwise triangle with a {n} cm side reflects across the x-axis. Describe the image.",
                "Congruent, counterclockwise",
                ["Congruent, clockwise", "Larger, counterclockwise"],
            )
        return choice(
            f"A square of side {n} is dilated by 2. Which relationship holds?",
            "Similar with a different perimeter",
            ["Congruent with the same area", "Different corresponding angles"],
        )
    if slug == "angles":
        a = 35 + 3 * n
        if v == 0:
            return q(
                f"Parallel rails cross a transversal. A {a}° angle has a corresponding angle on the other rail. Find its measure.",
                a,
            )
        if v == 1:
            return q(
                f"On parallel lines, same-side interior angles are {a}° and x°. Find x.",
                180 - a,
            )
        return choice(
            f"An alternate interior angle matches a {a}° angle. Which argument explains why?",
            "Corresponding angles match, then vertical angles match",
            [
                "All four angles at a crossing are equal",
                "Every pair of interior angles sums to 90°",
            ],
        )
    if slug == "triangle":
        a, b = 30 + n, 40 + 2 * n
        if v == 0:
            return q(
                f"A triangle has angles {a}° and {b}°. Find its third interior angle.",
                180 - a - b,
            )
        if v == 1:
            return q(
                f"A triangle's exterior angle is {a+b}°. A remote interior angle is {a}°. Find the other remote angle.",
                b,
            )
        return choice(
            f"Triangle A has angles {a}° and {b}°. Triangle B has angles {b}° and {180-a-b}°. Which argument proves similarity?",
            f"Both have a {a}° angle and a {b}° angle",
            [
                "One matching angle alone proves similarity",
                "All corresponding sides must be equal",
            ],
        )
    if slug == "slope":
        if v == 0:
            return q(
                f"Two right triangles follow one line. The first rises {2*n} over 4. How far does the second rise over 12?",
                6 * n,
            )
        if v == 1:
            return q(
                f"A line passes through (2, {3*n}) and (5, 0). Find its slope.", -n
            )
        return q(
            f"A slope triangle rises {4*n} over {2*n}. A different triangle on that line runs {n}. Find its rise.",
            2 * n,
        )
    if slug == "direct":
        if v == 0:
            return point(
                f"A proportional graph passes through (2, {2*n}). Plot the point with x = 1.",
                1,
                n,
            )
        if v == 1:
            return q(
                f"{n} tickets cost ${n*k}. At the same price, what will {n+3} tickets cost?",
                (n + 3) * k,
            )
        return q(
            f"y varies directly with x. If y = {n*k} at x = {n}, find y at x = 10.",
            10 * k,
        )
    if slug == "intercept":
        vis = table(
            ["Hours", "Liters"], [(2, 2 * n + k), (4, 4 * n + k), (6, 6 * n + k)]
        )
        if v == 0:
            return q("How many liters does the tank gain each hour?", n, visual=vis)
        if v == 1:
            return q("How many liters were in the tank at hour zero?", k, visual=vis)
        return q(
            f"A straight line passes through (2, {3*n}) and (3, {4*n}). Find its y-intercept.",
            n,
        )
    if slug == "linear":
        line = f"y = {n}x + {k}"
        if v == 0:
            return choice(
                f"A taxi charges ${k} plus ${n} per mile. Choose its cost equation.",
                line,
                [f"y = {k}x − {n}", f"y = {n+k}x"],
            )
        if v == 1:
            return choice(
                "Which equation models the table?",
                line,
                [f"y = {n}x", f"y = {n}x − {k}"],
                table(["x", "y"], [(0, k), (1, n + k), (2, 2 * n + k)]),
            )
        return point(f"Plot the y-intercept of y = {n}x + {k}.", 0, k)
    if slug == "proportional":
        if v == 0:
            return choice(
                f"A meter begins at {n} liters and gains {k} liters each minute. Is the reading proportional to time?",
                "No, the initial reading is nonzero",
                ["Yes, the rate is constant", "Yes, volume increases"],
            )
        if v == 1:
            return choice(
                "Choose the model that fits these measurements.",
                f"y = {n}x",
                [f"y = {n}x + 1", f"y = x + {n}"],
                table(["x", "y"], [(0, 0), (2, 2 * n), (4, 4 * n)]),
            )
        return choice(
            f"A worker quotes a rate of ${n} per hour. Which pay plan is proportional to hours?",
            f"${n} per hour from a zero balance",
            [f"${n} setup plus hourly wages", f"A fixed ${n} regardless of hours"],
        )
    if slug == "functions":
        if v == 2 and n % 3 == 0:
            return choice(
                f"Apply the vertical-line test to the plotted relation around x = {n}. Is it a function?",
                "No",
                ["Yes", "No"],
                dict(kind="scatter", points=[[n - 1, 2], [n, 4], [n, 6]]),
            )
        valid = n % 2 == 0
        pairs = [(1, n), (2, n + 1), (3 if valid else 1, n + 2)]
        representations = [
            str(pairs),
            ", ".join(f"{x} → {y}" for x, y in pairs),
            "the displayed table",
        ][v]
        return choice(
            f"Does {representations} assign just one output to each input?",
            "Yes" if valid else "No",
            ["Yes", "No"],
            table(["Input", "Output"], pairs) if v == 2 else None,
        )
    if slug == "model":
        n += 3
        left = f"{n} + 2x"
        right = f"{n+1}x"
        if v == 0:
            return choice(
                f"A pass costs ${n} plus $2 per ride. Single rides cost ${n+1} each. Model equal costs.",
                f"{left} = {right}",
                [f"{n}x + 2 = {right}", f"{left} = {n+1} + x"],
            )
        if v == 1:
            return choice(
                f"Model when a ${n} fee plus $2 per visit costs at most ${n+1} per visit.",
                f"{left} ≤ {right}",
                [f"{left} > {right}", f"{left} = {right}"],
            )
        return fields(
            f"Write a comparison story for {left} > {right} by completing its statements.",
            ["Plan A charges", "Compared with Plan B"],
            [f"${n} up front plus $2 per visit", f"Costs more than ${n+1} per visit"],
            [
                [f"${n} per visit plus $2 up front"],
                [f"Costs less than ${n+1} per visit"],
            ],
            seed,
            kind="story",
        )
    if slug == "solve":
        if v == 0:
            return q(f"Solve 3x + {2*n} = x + {4*n}.", n)
        if v == 1:
            return q(f"Solve 1.5x − {n} = 0.5x + {n}.", 2 * n)
        return q(
            f"Two balances are {n} + 4w and {4*n} + w dollars. At which week w are they equal?",
            n,
        )
    if slug == "inequality":
        if v == 0:
            return q(f"What is the least whole x for which 2x + {3*n} < 5x?", n + 1)
        if v == 1:
            return choice(
                f"Solve {2*n} − x ≥ x.", f"x ≤ {n}", [f"x ≥ {n}", f"x ≤ {2*n}"]
            )
        return q(
            f"A rental costs ${3*n} plus $2 per hour. Another costs $5 per hour. At most how many whole hours is the second no more expensive?",
            n,
        )
    if slug == "systems":
        b = n + 1
        if v == 0:
            return q(
                f"Lines y = 2x + 1 and y = x + {b} intersect. What is the x-coordinate?",
                n,
            )
        if v == 1:
            return q(
                f"The two graphs intersect at x = {n}. The lines are y = 3x and y = 2x + {n}. Find the common y.",
                3 * n,
            )
        return choice(
            f"Use the graph of y = x + {n} and y = 2x. Which intersection satisfies both?",
            f"({n}, {2*n})",
            [f"(0, {n})", f"({n}, {n})"],
            dict(
                kind="intersection",
                points=[[0, n], [2 * n, 3 * n], [0, 0], [2 * n, 4 * n]],
            ),
        )
    if slug == "pythagoras":
        if v == 0:
            return q(
                f"The squares on the two legs have areas {9*n*n} and {16*n*n}. Find the area on the hypotenuse.",
                25 * n * n,
                visual=dict(
                    kind="pythagorean", labels=[str(9 * n * n), str(16 * n * n), "?"]
                ),
            )
        if v == 1:
            return q(
                f"A right triangle's largest square has area {25*n*n}. Another has area {9*n*n}. Find the third square's side length.",
                4 * n,
            )
        return choice(
            f"A diagram cuts a square of side {7*n} into four right triangles with legs {3*n} and {4*n} around a central square. What area is left?",
            str(25 * n * n),
            [str(49 * n * n), str(12 * n * n)],
        )
    if slug == "missing-side":
        if v == 0:
            return q(
                f"A right triangle has legs {3*n} and {4*n} cm. Find the hypotenuse.",
                5 * n,
            )
        if v == 1:
            return q(
                f"A taut {13*n} m cable runs from the top of a vertical post to an anchor {5*n} m from its base on level ground. Find the post height in meters.",
                12 * n,
            )
        c = 5 * n + n % 2
        return choice(
            f"Do lengths {3*n}, {4*n} and {c} make a right triangle? Test the converse.",
            "Yes" if c == 5 * n else "No",
            ["Yes", "No"],
        )
    if slug == "distance":
        x, y = n - 6, 3 - n
        dx, dy = [(3, 4), (-5, 12), (8, -15)][v]
        return q(
            f"Find the straight-line distance from ({x}, {y}) to ({x+dx*n}, {y+dy*n}).",
            n * [5, 13, 17][v],
        )
    if slug == "cylinder":
        if v == 0:
            return q(
                f"A cylinder has base area {n*n} cm² and height {k} cm. Find its volume in cm³.",
                n * n * k,
            )
        if v == 1:
            return q(
                f"A cylinder has diameter {2*n} and height {k}. Its volume is cπ. Find c.",
                n * n * k,
            )
        return q(
            f"A cylinder has volume {n*k}π m³ and base area {k}π m². Find its height in meters.",
            n,
        )
    if slug == "cone":
        if v == 0:
            return q(
                f"A cylinder holds {9*n} L. A cone has the same base and height. Find its capacity.",
                3 * n,
            )
        if v == 1:
            return q(
                f"A cone has radius {n} and height 6. Its volume is cπ. Find c.",
                2 * n * n,
            )
        return q(
            f"A cone has volume {n*k} cm³. What is the volume of a cylinder with the same base and height?",
            3 * n * k,
        )
    if slug == "sphere":
        r = 3 * n
        if v == 0:
            return q(f"A ball has radius {r} cm. Find c in V = cπ cm³.", 4 * r**3 // 3)
        if v == 1:
            return q(
                f"A ball has diameter {2*r} m. Find c in V = cπ m³.", 4 * r**3 // 3
            )
        return q(
            f"A hemisphere has radius {r} cm. Find the coefficient of π in half the sphere's volume.",
            2 * r**3 // 3,
        )
    if slug == "prism-surface":
        if v == 0:
            return q(
                f"A rectangular prism stands {k} cm tall on a {n} by 3 cm base. Find the lateral area.",
                2 * (n + 3) * k,
            )
        if v == 1:
            return q(
                f"A closed box measures {n} by 3 by {k} cm. Find its total surface area.",
                2 * (3 * n + 3 * k + n * k),
            )
        return q(
            f"A triangular prism has right-triangle bases with legs 3 and 4 cm and hypotenuse 5 cm. Its length is {n} cm. Find total surface area.",
            12 * n + 12,
        )
    if slug == "cylinder-surface":
        if v == 0:
            return q(
                f"Unroll a cylinder with radius {n} and height {k}. What is the coefficient of π in the lateral area?",
                2 * n * k,
            )
        ends = 2 if v == 1 else 1
        return q(
            f"A cylinder with radius {n} and height {k} has {ends} circular end(s) covered. Find the coefficient of π in the covered area, including the side.",
            2 * n * k + ends * n * n,
        )
    if slug == "scatter":
        if v == 1:
            return scatter_task([(1, n), (3, n - 1), (4, 1 + (n + k) % 9)])
        if v == 2 and n % 2:
            return choice(
                "Which shape best describes how y changes with x?",
                "Curved pattern",
                ["Straight line", "No clear pattern"],
                dict(kind="scatter", points=[[x, n + x * x] for x in range(5)]),
            )
        traces = [[1, 3, 4, 6, 7], [9, 7, 6, 4, 3], [2, 8, 3, 1, 7]]
        pts = [[x + 1, y + n] for x, y in enumerate(traces[v])]
        return choice(
            "Use the paired observations to identify their association.",
            ["Positive linear", "Negative linear", "No clear linear pattern"][v],
            ["Positive linear", "Negative linear", "No clear linear pattern"],
            dict(kind="scatter", points=pts),
        )
    if slug == "trend":
        if v == 0:
            return q(
                f"A trend line for plant height is h = {n}d + {k}. Predict the height on day 5.",
                5 * n + k,
            )
        if v == 1:
            return q(
                f"A trend predicts {2*n} customers at hour 2 and {4*n} at hour 4. Estimate hour 5.",
                5 * n,
            )
        return q(
            f"A fitted line predicts {3*n} points but the observed value is {4*n}. How far above the line is the observation?",
            n,
        )
    if slug == "mad":
        b = n + 10
        values = [
            [b - n, b, b + n],
            [b - n, b - n, b + n, b + n],
            [b - 3, b - 1, b + 1, b + 3],
        ][v]
        mad = F(sum(abs(x - b) for x in values), len(values))
        return q(
            f"Find the mean absolute deviation of {', '.join(map(str,values))}. Give an exact value.",
            mad,
        )
    if slug == "sampling":
        population = 5 * (n + 1)
        rng = Random(seed)
        samples = [
            sum(rng.randrange(100) < population for _ in range(20)) for _ in range(5)
        ]
        vis = table(
            ["Random sample (20 each)", "Blue draws"],
            [(i + 1, c) for i, c in enumerate(samples)],
        )
        if v < 2:
            sim = dict(kind="simulation", sampleSize=20,
                       outcomes=[f"Sample {i}: {count} blue" for i, count in enumerate(samples, 1)])
            if v == 0:
                return q(
                    f"A population is {population}% blue. Draw five samples of 20 with replacement. What percent of all 100 draws were blue?",
                    sum(samples), visual=sim,
                )
            return q(
                f"A population is {population}% blue. Draw five samples of 20 with replacement. How many percentage points apart are the first sample and the population?",
                abs(5 * samples[0] - population), visual=sim,
            )
        return choice(
            f"With equally likely draws from a {population}% blue population, which procedure generates comparable random samples?",
            "Replace after each draw and repeat samples of 20",
            ["Pick blue items first", "Change sample size after each blue draw"],
            vis,
        )
    if slug == "interest":
        p = n * 100
        if v == 0:
            return q(
                f"Find the simple interest earned on ${p} at 5% per year for three years.",
                15 * n,
            )
        if v == 1:
            return q(
                f"Deposit ${p} at 10% compounded annually. How many dollars of interest are earned in two years?",
                21 * n,
            )
        return q(
            f"Compare two years at 10% on ${p}. How many more dollars does annual compounding earn than simple interest?",
            n,
        )
    if slug == "loans":
        p = n * 100
        if v == 0:
            rate = F(6 + n, 1200)
            months = 12 if n % 2 else 24
            monthly = round(p * rate / (1 - (1 + rate) ** (-months)) * 100)
            return decimal(
                f"Use the loan calculator for ${p} at {6+n}% APR over {months} months. Using its rounded monthly payment, find total payments in dollars.",
                F(monthly * months, 100),
                2,
            ) | {"visual": dict(kind="loan", values=[p, 6 + n, months])}

        if v == 1:
            return q(
                f"For the same principal, two loan offers show 12 payments of ${10*n} or 24 of ${6*n}. How much less does the shorter loan cost?",
                24 * n,
            )
        return q(
            f"An easy-access loan of ${p} charges ${15*n} per two-week term. After two terms, what total principal plus fees is due?",
            130 * n,
        )
    if slug == "invest":
        d = 100 * n
        if v == 0:
            return q(
                f"Deposit ${d} at each year end. At 5% annually, what is the balance just after the second deposit?",
                205 * n,
            )
        if v == 1:
            return q(
                f"At 10% annually, deposit ${d} at each year end for three years. How much interest has accrued just after deposit three?",
                31 * n,
            )
        return q(
            f"Save ${n*10} monthly for retirement. After one year, interest adds ${n}. Find the year-end balance.",
            121 * n,
        )
    if slug == "payments":
        if v == 0:
            return q(
                f"A ${100*n} purchase has a 3% credit surcharge. Debit has no fee. How many dollars does debit save?",
                3 * n,
            )
        if v == 1:
            return choice(
                f"You have ${n*10} in checking and need an item costing ${n*10-3}. Which way uses existing funds and avoids borrowing?",
                "Use a fee-free debit card",
                ["Roll over a payday loan", "Carry a credit balance at interest"],
            )
        return choice(
            f"A bill of ${n*10} is due today and funds are available. Which decision avoids a late fee and protects payment history?",
            "Pay on time and record the payment",
            ["Ignore the due date", "Send less than the required minimum"],
        )
    if slug == "college":
        annual = 3000 * n
        if v == 0:
            return q(
                f"A two-year program costs ${annual} annually. Family contributes ${n*1000} in total. Find the remaining two-year cost.",
                2 * annual - n * 1000,
            )
        if v == 1:
            return q(
                f"Estimate four years at ${annual} per year including living costs. A grant covers ${n*500} each year. Find total out-of-pocket cost.",
                4 * (annual - n * 500),
            )
        return q(
            f"The first college year costs ${annual}. Family covers ${600*n}. How many dollars per month for 24 months cover the gap?",
            100 * n,
        )
    raise ValueError(slug)
