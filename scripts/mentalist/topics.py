"""Version-one level templates for applications, representations, and guided tasks."""

from fractions import Fraction as F
from formats import q, choose, fields, table, chart, grid


def topic(s, l, n, v):
    a = 3 + n % 31
    b = 2 + (n * 3) % 9
    k = 2 + n % 6
    if s == "number.sets":
        if l == 1:
            val = [str(a), f"−{a}", f"1/{a}"][v]
            return choose(
                f"What is the smallest listed set containing {val}?",
                ["Whole numbers", "Integers", "Rational numbers"][v],
                ["Whole numbers", "Integers", "Rational numbers"],
                n,
            )
        val = ["natural numbers (1, 2, …)", "whole numbers", "integers"][v]
        sets = ["Whole numbers", "Integers", "Rational numbers"]
        return choose(
            f"{a} belongs to the {val}. Which listed set is the next larger standard set containing all {val}?",
            sets[v],
            ["Natural numbers", *sets],
            n,
        )
    if s == "number.mixed":
        if l == 1:
            return q(f"({a} − {b}) × 2 + 5", 2 * (a - b) + 5)
        if l == 2:
            return q(f"{a}.5 − {b}/2", F(2 * a + 1 - b, 2), "fraction")
        return q(
            f"Round each factor to the nearest whole before multiplying: {a}.1 × {b}.8.",
            a * (b + 1),
        )
    if s == "number.context":
        return [
            q(f"At −{a} m, a diver rises {b} m. New elevation in meters?", b - a),
            q(
                f"A balance of $−{a} receives a ${b} deposit. New balance in dollars?",
                b - a,
            ),
            q(
                f"It was −{a}°. It warmed {b}° and then cooled 4°. Final temperature?",
                b - a - 4,
            ),
        ][l - 1]
    if s.startswith("ratio.") or s == "linear.read" or s == "linear.represent":
        data = table(["x", "y"], [(1, k), (2, k * 2), (a, k * a)])
        graph = dict(
            kind="plot",
            points=[[0, 0], [1, k], [2, 2 * k]],
            labels=["Hours", "Kilometers"],
        )
        if s == "ratio.equivalent":
            if l == 1:
                return q(
                    f"A bowl holds {a} pears and {b} plums. In the ratio of pears to all fruit, {a} to □, fill the blank.",
                    a + b,
                )
            if l == 2:
                return q(f"{a} : {b} = {a*k} : □", b * k)
            return fields(
                "Complete the proportional table.",
                ["y when x = " + str(a), "y when x = " + str(a + 1)],
                [a * k, (a + 1) * k],
                [[a + k, a], [a * k, k + 1]],
                n,
                table(["x", "y"], [(1, k), (a, "?"), (a + 1, "?")]),
            )
        if s == "ratio.unit":
            if l == 1:
                return q(f"{a} books cost ${a*b}. Dollars per book?", b)
            if l == 2:
                return q(
                    f"{a}/2 liters cover {b}/2 m². Liters per m²?", F(a, b), "fraction"
                )
            other = b + v - 1
            return choose(
                f"{a} bars cost ${a*b}. A second shop sells bars for ${other} each. Which is cheaper per bar?",
                ["Second shop", "Same price", "First shop"][v],
                ["First shop", "Second shop", "Same price"],
                n,
            )
        if s == "ratio.constant":
            if l == 1:
                return q(f"Find y/x using the row x = {a}.", k, visual=data)
            if l == 2:
                return q(
                    f"The line continues for {a} hours. What is its constant rate in km/h?",
                    k,
                    visual=graph,
                )
            return q(
                f"{a} identical packs contain {a*k} pens. In y = kx, find k for pens per pack.",
                k,
            )
        if s == "ratio.represent":
            if l == 1:
                return q(
                    f"Each box contains {k} pencils. How many pencils in {a} boxes?",
                    a * k,
                )
            if l == 2:
                return q(
                    f"Use the table to predict y for x = {a+1}.",
                    (a + 1) * k,
                    visual=data,
                )
            if l == 3:
                return q(
                    f"Use the graph to predict distance at {a} hours.",
                    a * k,
                    visual=graph,
                )
            return choose(
                f"Which equation fits these pairs, including ({a}, {a*k})?",
                f"y = {k}x",
                [f"y = x + {k}", f"y = {k+1}x"],
                n,
                data,
            )
        if s == "ratio.travel":
            return [
                q(f"At {a} km/h for {b} hours, find distance in km.", a * b),
                q(f"Traveling {a*b} km in {b} hours, find km/h.", a),
                q(f"At {a} km/h, how many hours for {a*b} km?", b),
            ][l - 1]
        if s == "ratio.solve":
            return [
                q(f"{b} portions need {a*b} g of oats. Grams for {k} portions?", a * k),
                q(
                    f"One tap fills {a*b} L in {b} minutes, another {a+k} L/min. Difference in L/min?",
                    k,
                ),
                q(
                    f"{a} crates each hold {b} packs of {k} cans. How many cans?",
                    a * b * k,
                ),
            ][l - 1]
        if s == "ratio.units":
            if v == 1:
                return q(f"Use 1 in = 2.54 cm. Convert {a*254/100:g} cm to inches.", a)
            return q(
                f'Use 1 in = 2.54 cm. {"Set up a proportion to convert" if l==2 else "Convert"} {a} inches to centimeters.',
                F(a * 254, 100),
                "decimal",
            )
        intercept = b
        data = table(["Hours", "Liters"], [(0, b), (1, b + k), (a, b + k * a)])
        if s == "linear.read":
            return [
                q("Find the rate in liters per hour.", k, visual=data),
                q("Find the initial amount in liters.", b, visual=data),
                q(
                    f"After {a} hours, how many more liters than at the start?",
                    k * a,
                    visual=data,
                ),
            ][l - 1]
        if l == 1:
            return fields(
                f"Complete the table for y = {k}x + {b}.",
                ["x = " + str(a), "x = " + str(a + 1)],
                [k * a + b, k * (a + 1) + b],
                [[a, b], [a + 1, b]],
                n,
            )
        if l == 2:
            x = n % 7 - 3
            slope = 1 + n // 7 % 2
            offset = n // 14 % 5 - 2
            return grid(
                f"Plot the point at x = {x} on y = {slope}x + {offset}.",
                x,
                slope * x + offset,
            )
        return choose(
            f"Which equation matches the table at x = {a}?",
            f"y = {k}x + {b}",
            [f"y = {b}x − {k}", f"y = {k}x"],
            n,
            data,
        )
    if s.startswith("percent."):
        total = a * 100
        rate = b * 5
        part = a * rate
        if s == "percent.parts":
            if l == 1 and v == 2:
                return q(
                    f"A bar represents {total}. What amount is shaded?",
                    part,
                    visual=dict(kind="percent", values=[rate], labels=[str(total)]),
                )
            return [
                q(f"What is {rate}% of {total}?", part),
                q(f"{part} is {rate}% of what whole?", total),
                q(f"{part} is what percent of {total}?", rate),
            ][l - 1]
        if s == "percent.change":
            factor = 100 - rate if v % 2 else 100 + rate
            return [
                q(
                    f"A price changes from ${total} to ${a*factor}. Find the size of the percent change.",
                    rate,
                ),
                q(
                    f'Change ${total} by a {rate}% {"decrease" if v%2 else "increase"}. New price?',
                    a * factor,
                ),
                q(
                    f"After a {rate}% increase the price is ${a*(100+rate)}. Original price?",
                    total,
                ),
            ][l - 1]
        if l == 3:
            return q(
                f"On ${total}, compare {rate}% off with ${part+5} off. How much more does the better offer save?",
                5,
            )
        return q(
            f'An item is ${total}. Apply {rate}% off and then {"10% sales tax" if l==2 else "a further 10% discount"}. Final price?',
            F(a * (100 - rate) * (110 if l == 2 else 90), 100),
            "decimal",
        )
    if s.startswith("similar."):
        if s == "similar.attributes":
            if l == 1:
                return choose(
                    f"△ABC ∼ △DEF. If AB is {a} cm, which side corresponds to AB?",
                    "DE",
                    ["EF", "DF"],
                    n,
                )
            if l == 2:
                return q(
                    f"Corresponding sides are {a} cm and {a*k} cm. Scale from the first triangle to the second?",
                    k,
                )
            off = v % 2
            return choose(
                f"Triangles have sides ({a},{a+1},{a+2}) and ({2*a},{2*a+2},{2*a+4+off}). Similar?",
                "No" if off else "Yes",
                ["Yes", "No"],
                n,
            )
        if s == "similar.lengths":
            return [
                q(
                    f"An image changes a {a*k} cm side to {a} cm. Find its scale factor.",
                    F(1, k),
                    "fraction",
                ),
                q(
                    f"Scale factor {k}: a side is {a} cm before scaling. Length after?",
                    a * k,
                ),
                q(
                    f"A {b} m pole casts a {k} m shadow. A tree casts a {a*k} m shadow. Height in m?",
                    a * b,
                ),
            ][l - 1]
        if l == 3:
            x = 1 + n % 8
            y = 1 + n // 3 % 8
            return grid(
                f"Complete the scale drawing. A rectangle begins at (0,0), width {2*x} m and height {2*y} m. Plot its opposite corner at 2 m per square.",
                x,
                y,
                10,
                "drawing",
            )
        return q(
            f'Scale: 1 cm represents {k} km. {"Distance in km for "+str(a)+" cm" if l==1 else "Length in cm for "+str(a*k)+" km"}?',
            a * k if l == 1 else a,
        )
    if s.startswith("chance."):
        total = a + b
        if s == "chance.space":
            if l == 1:
                return q(
                    f"A spinner has {a} uniquely labeled spaces. How many possible labels?",
                    a,
                )
            if l == 2:
                return q(
                    f"Choose one of {a} shirts and one of {b} hats. How many ordered outfits?",
                    a * b,
                )
            return fields(
                f"Complete a tree for {a} colors followed by {b} letters.",
                ["First branches", "Leaves per branch", "Total leaves"],
                [a, b, a * b],
                [[a + 1, a * b], [b + 1, a * b], [a * b + 1, b]],
                n,
                kind="tree",
            )
        if s == "chance.theoretical":
            return [
                q(
                    f"A bag has {a} red and {b} blue counters. Uniform draw: P(red)?",
                    F(a, total),
                    "fraction",
                ),
                q(
                    f"Flip a fair coin and roll a fair {a}-sided die numbered 1–{a}. P(heads and 1)?",
                    F(1, 2 * a),
                    "fraction",
                ),
                q(
                    f"With probability 1/{b} of winning, predict wins in {a*b} trials.",
                    a,
                ),
            ][l - 1]
        if s == "chance.complement":
            if l == 2 and v == 2:
                return q(
                    f"All {a} counters are blue. Find the probability that a draw is not blue.",
                    0,
                )
            return q(
                f'P({"rain" if l==1 else "winning"}) = {a}/{total}. P({"no rain" if l==1 else "not winning"})?',
                F(b, total),
                "fraction",
            )
        if s == "chance.experimental":
            return q(
                f'In {total} {"two-coin" if l==2 else "spinner"} trials, a target event occurs {a} times. '
                + (
                    "Predict its count in twice as many trials."
                    if l == 3
                    else "Estimate its probability."
                ),
                2 * a if l == 3 else F(a, total),
                None if l == 3 else "fraction",
            )
        if s == "chance.simulate":
            if l == 1:
                return choose(
                    f"A bag has {a} equally likely colors. Which simulation gives each a fair chance?",
                    "One equal sector per color",
                    ["One large sector for red", "Always alternate two colors"],
                    n,
                )
            outcomes = ["H" if (n * 7 + i * 3) % 11 < 5 else "T" for i in range(8)]
            return (
                fields(
                    f"Run trial sequence {a} and record the outcomes.",
                    ["Heads", "Tails"],
                    [outcomes.count("H"), outcomes.count("T")],
                    [[0, 1, 2, 3, 4, 5, 6, 7, 8]] * 2,
                    n,
                    dict(kind="simulation", outcomes=outcomes),
                    kind="simulation",
                )
                if l == 2
                else q(
                    f"{a} successes in {total} simulations. Predict successes in {total*3} more.",
                    3 * a,
                )
            )
        if l == 1:
            return choose(
                f"A fair coin lands heads {a} times in {2*a+2} trials. How does the observed heads rate compare with 1/2?",
                "Lower",
                ["Higher", "Equal"],
                n,
            )
        return q(
            f"A spinner landed on green {a} times in {total} trials. Based on the data, predict green outcomes in {total*4} trials.",
            4 * a,
        )
    if s.startswith("stats."):
        if s == "stats.graphs":
            if l == 1 and v == 1:
                return q(
                    f"How many observations have value {a+1}?",
                    v + 2,
                    visual=chart(
                        "dots", [2, v + 2, 4], [str(a), str(a + 1), str(a + 2)]
                    ),
                )
            if l == 3 and v == 1:
                return q(
                    "Find the ratio of walkers to cyclists as a simplified fraction.",
                    F(a, b),
                    "fraction",
                    visual=chart("bars", [a, b], ["Walk", "Bike"]),
                )
            vis = chart("pie" if l == 2 else "bars", [a, b], ["Walk", "Bike"])
            return q(
                (
                    "How many trips are represented?"
                    if l == 1
                    else "What fraction of all trips are walks?"
                ),
                a + b if l == 1 else F(a, a + b),
                None if l == 1 else "fraction",
                visual=vis,
            )
        if s == "stats.groups":
            vis = dict(
                kind="boxes",
                rows=[
                    [a, a + 1, a + 2, a + 3, a + 4],
                    [a, a + 1, a + 4, a + 8, a + 14],
                ],
                labels=["Group A", "Group B"],
            )
            if l == 1:
                return choose(
                    f"Which group has a longer right whisker on the common scale starting at {a}?",
                    "Group B",
                    ["Group A", "Equal"],
                    n,
                    vis,
                )
            return q(
                f'Compare the {"medians" if l==2 else "IQRs"} on the common scale starting at {a}. How much larger is B’s?',
                2 if l == 2 else 5,
                visual=vis,
            )
        if s == "stats.sample":
            total = a + b
            if l == 1:
                return q(
                    f"{a} of {total} randomly sampled students walk. Estimate walkers in a school of {total*10}.",
                    a * 10,
                )
            return choose(
                f"{a} of {a+b} randomly sampled students bike. What can this sample support?",
                "An estimate of the school proportion",
                ["An exact count for the school", "A guarantee about every class"],
                n,
            )
        if l == 1:
            return q(
                f"Sample A has mean {a}; sample B has mean {a+b}. Difference in means?",
                b,
            )
        return choose(
            f"Random samples have means {a} and {a+b}. Which conclusion is supported?",
            "The samples suggest a higher mean in B",
            [
                "Every B value exceeds every A value",
                "The populations have no variability",
            ],
            n,
        )
    if s.startswith("algebra."):
        if s == "algebra.check":
            rhs = k * a + b + (1 if v == 1 else 0)
            relation = "=" if l == 1 else "≤"
            valid = k * a + b == rhs if l == 1 else k * a + b <= rhs - v
            if l == 2:
                rhs -= v
            return choose(
                f"Does x = {a} satisfy {k}x + {b} {relation} {rhs}?",
                "Yes" if valid else "No",
                ["Yes", "No"],
                n,
            )
        if s == "algebra.equation":
            if l == 1:
                return q(
                    "Each box has the same value. Find the value of one box.",
                    a,
                    visual=dict(kind="balance", values=[k, b, k * a + b]),
                )
            if l == 3:
                return q(
                    f"x/{k} + {b}/2 = {a+b}/2. Find x as a fraction.",
                    F(a * k, 2),
                    "fraction",
                )
            if l == 4 and v == 2:
                return choose(
                    f"Check x = {a} in {k}x + {b} = {k*a+b+1}. Is it a solution?",
                    "No",
                    ["Yes"],
                    n,
                )
            if l == 4:
                return q(
                    f"A ride costs ${b} plus ${k} per mile. The total is ${k*a+b}. How many miles?",
                    a,
                )
            return q(f"{k}x − {b} = {k*a-b}. Find x.", a)
        if s == "algebra.inequality":
            negative = l == 3
            coef = -k if negative else k
            if l == 4:
                return q(
                    f"Entry costs ${b} and tickets cost ${k} each. With ${b+k*a+1}, what is the maximum whole number of tickets?",
                    a,
                )
            return choose(
                f"Solve {coef}x + {b} < {coef*a+b}.",
                f'x {">" if negative else "<"} {a}',
                [f'x {"<" if negative else ">"} {a}', f"x = {a}"],
                n,
                table(["Coefficient", "Added units"], [(coef, b)]) if l == 1 else None,
            )
        if s == "algebra.write":
            relation = "=" if l == 1 or (l == 3 and v == 0) else "≤"
            return choose(
                f'A fee of ${b} plus ${k} per ticket costs {"exactly" if relation=="=" else "at most"} ${k*a+b}. Which constraint uses x for tickets?',
                f"{k}x + {b} {relation} {k*a+b}",
                [f"{b}x + {k} ≥ {k*a+b}", f"{k}x − {b} = {k*a+b}"],
                n,
            )
        if s == "algebra.story":
            rel = "exactly" if l == 1 else "at most"
            return fields(
                f'Build a ticket-price story for {k}x + {b} {"=" if l==1 else "≤"} {k*a+b}.',
                ["Per ticket", "Entry fee", "Total"],
                [f"${k}", f"${b}", f"{rel} ${k*a+b}"],
                [[f"${k+1}"], [f"${b+1}"], [f"at least ${k*a+b}"]],
                n,
                kind="story",
            )
        x = n % 19 - 9
        if l == 1:
            return grid(f"Mark the solution: x + {b} = {x+b}.", x, 0, 10, "line")
        direction = "Right" if v % 2 else "Left"
        inclusive = l == 3
        rel = (
            ("≥" if inclusive else ">")
            if direction == "Right"
            else ("≤" if inclusive else "<")
        )
        return fields(
            f"Construct the number line for x {rel} {x}.",
            ["Boundary", "Endpoint", "Ray"],
            [x, "Closed" if inclusive else "Open", direction],
            [[x - 1, x + 1], ["Open", "Closed"], ["Left", "Right"]],
            n,
            kind="ray",
        )
    return geometry_finance(s, l, n, v, a, b, k)


def geometry_finance(s, l, n, v, a, b, k):
    if s == "geometry.angles":
        if l == 1:
            return q(
                f"Two angles sum to {90 if v%2 else 180}°. One measures {a}°. Find the other.",
                (90 if v % 2 else 180) - a,
            )
        if l == 2 and v == 0:
            return q(f"Two vertical angles measure 2x and {2*a} degrees. Find x.", a)
        return q(
            f"Find x in the triangle.",
            180 - a - b,
            visual=dict(kind="triangle", labels=[f"{a}°", f"{b}°", "x°"]),
        )
    if s.startswith("circle."):
        pi = F(314, 100)
        if s == "circle.pi":
            if l == 1:
                return q(
                    f"A circle has diameter {a} cm and circumference {float(pi*a):g} cm. Estimate π as C ÷ d.",
                    pi,
                    "decimal",
                )
            return q(
                f"Circle sectors form a near-rectangle of height {a} and base π × {a}. What number multiplies π in the area?",
                a * a,
            )
        if l == 1 or (l == 4 and v == 0):
            return q(
                f"Use π = 3.14. Find circumference for diameter {a} cm.",
                pi * a,
                "decimal",
            )
        if l == 3:
            return q(
                f"Circumference is {float(pi*2*a):g} cm. Use π = 3.14. Find radius in cm.",
                a,
            )
        return q(
            f"Use π = 3.14. Find area in cm² for radius {a} cm.", pi * a * a, "decimal"
        )
    if s == "area.composite":
        if l == 1:
            return q(
                f"A {a} × {b+2} rectangle has a 2 × {b} corner removed. Area remaining in square units?",
                a * (b + 2) - 2 * b,
            )
        if l == 2:
            return q(
                f"A rectangle of area {a*b} m² adjoins a triangle with base {a*2} m and height {b} m. Combined area?",
                2 * a * b,
            )
        if l == 3:
            return q(
                f"A trapezoid with bases {a} and {a+2} and height {b} joins a square of side {k}. Combined area?",
                (a + 1) * b + k * k,
            )
        if l == 4:
            return q(
                f"A semicircle of radius {a} joins a rectangle of area {a*b}. Use π = 3.14. Total area?",
                F(314 * a * a, 200) + a * b,
                "decimal",
            )
        return q(
            f"A {a+2} × {b+2} rectangle loses a 2 × 2 corner and gains a triangle with base 4 and height {k}. New area?",
            (a + 2) * (b + 2) - 4 + 2 * k,
        )
    if s in ("solid.prism", "solid.pyramid", "solid.models"):
        tri = l == 2 or (l == 3 and v == 1)
        base = F(a * 2 * b, 2 if tri else 1)
        height = 3 * k
        if s == "solid.models":
            return q(
                f'A {"triangular" if tri else "rectangular"} prism has volume {base*height} cm³. A pyramid shares its base and height. Pyramid volume?',
                base * k,
            )
        noun = "pyramid" if s == "solid.pyramid" else "prism"
        return q(
            f'A {noun} has a {"triangular" if tri else "rectangular"} base, {2*a} cm across by {b} cm perpendicular base height. Solid height {height} cm. Volume in cm³?',
            base * (k if noun == "pyramid" else height),
        )
    if s in ("solid.nets", "solid.surface"):
        # A right triangular base uses a scaled 3-4-5 triangle. Slant heights
        # for the triangular pyramid below are given as individual face areas.
        shapes = [
            "rectangular prism",
            "triangular prism",
            "square pyramid",
            "triangular pyramid",
        ]
        areas = [
            [a * b, a * b, a * k, a * k, b * k, b * k],
            [6 * a * a, 6 * a * a, 3 * a * k, 4 * a * k, 5 * a * k],
            [a * a] + [a * (a + b)] * 4,
            [6 * a * a] + [6 * a * a] * 3,
        ]
        vals = areas[l - 1]
        bases = 2 if l <= 2 else 1
        vis = dict(kind="net", solid=l, values=vals)
        if s == "solid.nets":
            return fields(
                f"Complete the face record for this {shapes[l-1]} net. The labeled numbers are face areas.",
                ["Base faces", "Lateral faces", "Area of one base"],
                [bases, len(vals) - bases, vals[0]],
                [[1, 2, 3], [2, 3, 4], [vals[0] + 1, vals[0] + 2]],
                n,
                vis,
                "net",
            )
        lateral = v % 2 == 1
        return q(
            f'Find {"lateral" if lateral else "total"} area of the {shapes[l-1]}. Face areas are shown in cm².',
            sum(vals[bases:] if lateral else vals),
            visual=vis,
        )
    if s == "finance.tax":
        if l == 2:
            return q(
                f"For this exercise, a worker earns ${a*100} and pays a flat {b}% tax. Tax in dollars?",
                a * b,
            )
        return q(
            f'An item costs ${a*100}; the stated sales tax is {b}%. Find {"tax alone" if v==0 else "total purchase price"}.',
            a * b if v == 0 else a * (100 + b),
        )
    if s == "finance.budget":
        if l == 1:
            name = ["rent", "a restaurant meal", "emergency savings"][v]
            kind = ["Fixed expense", "Variable expense", "Saving"][v]
            return choose(
                f"A monthly budget includes ${a*b} for {name}. Classify this entry.",
                kind,
                ["Fixed expense", "Variable expense", "Saving"],
                n,
            )
        if l == 2:
            return q(
                f"Of ${a*100} income, ${a*b} goes to retirement. What percent is this?",
                b,
            )
        return fields(
            f"Budget ${a*100}: fixed costs 60%, savings 10%, variable costs the remainder.",
            ["Fixed ($)", "Savings ($)", "Variable ($)"],
            [a * 60, a * 10, a * 30],
            [[a * 10, a * 30], [a * 30, a * 60], [a * 60, a * 10]],
            n,
            kind="record",
        )
    if s == "finance.networth":
        if l == 1:
            label = ["cash balance", "loan owed", "bike owned"][v]
            val = "Liability" if v == 1 else "Asset"
            return choose(
                f"Classify a {label} of ${a*b}.", val, ["Asset", "Liability"], n
            )
        debt = a * (b + 1) if v % 2 else b
        return fields(
            f"Cash ${a*b}; debt ${debt}. Complete the statement.",
            ["Assets", "Liabilities", "Net worth"],
            [a * b, debt, a * b - debt],
            [[a * b + 1], [debt + 1], [a * b + debt]],
            n,
            kind="record",
        )
    if s == "finance.household":
        # MIT Living Wage Calculator, Harris County, TX, February 15, 2026.
        incomes = [
            44989,
            74800,
            93946,
            118744,
            60580,
            72410,
            77143,
            90107,
            60580,
            85195,
            102337,
            124352,
        ]
        i = n % 12
        workers = 2 if i >= 8 else 1
        household = f"{1 if i<4 else 2} adult(s), {workers} working, {i%4} child(ren)"
        vis = table(
            ["Harris County, TX · Feb 2026", "Annual dollars"],
            [("Required pre-tax household income", incomes[i])],
        )
        vis["source"] = "https://livingwage.mit.edu/counties/48201"
        if l == 1 and n // 12 % 2:
            available = incomes[i] - (1 + n % 9) * 500
            return q(f"{household}. A household earns ${available:,} per year. How many more annual dollars does it need to meet the estimate?", incomes[i] - available, visual=vis)
        if l == 1:
            return q(
                f"{household}. Use the estimator table to find required pre-tax household dollars per year.",
                incomes[i],
                visual=vis,
            )
        hours = [2080, 2000, 1950][n // 12 % 3]
        wage = F(round(F(incomes[i] * 100, hours * workers)), 100)
        return q(
            f"{household}. Each worker works {hours:,} hours a year at equal pay. Required hourly wage per worker, nearest cent?",
            wage,
            "decimal",
            places=2,
            visual=vis,
        )
    if s == "finance.simple":
        interest = a * b * k
        return q(
            f'${a*100} earns {b}% simple interest per year for {k} years. Find {"interest" if l==1 else "ending balance"} in dollars.',
            interest + (a * 100 if l == 2 else 0),
        )
    if s == "finance.compound":
        principal = 100 * a
        compound = F(principal * (100 + b) ** 2, 10000)
        if l == 1:
            return fields(
                f"${principal} earns {b}% compounded annually. Complete the two balances.",
                ["Year 1", "Year 2"],
                [f"{a*(100+b):.2f}", f"{float(compound):.2f}"],
                [[f"{principal:.2f}"], [f"{principal+2*a*b:.2f}"]],
                n,
            )
        return q(
            f"${principal} earns {b}% compounded annually for two years. Find "
            + (
                "the ending balance."
                if l == 2
                else "the extra earnings over simple interest at the same rate."
            ),
            compound if l == 2 else compound - principal - 2 * a * b,
            "decimal",
            places=2,
        )
    if s == "finance.deals":
        price = a * 100
        discount = a * b
        if l == 1:
            return q(
                f"A ${price} bike is {b}% off. Find its sale price.", price - discount
            )
        if l == 2:
            return q(f"A ${price} bike comes with a ${a} rebate. Net cost?", price - a)
        return q(
            f"A ${price} bike is {b}% off, then a ${k} coupon applies. What is the final cost?",
            price - discount - k,
        )
    raise KeyError((s, l))
