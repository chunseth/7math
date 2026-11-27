"""Representation and transfer variants assigned to explicit blueprint slots."""

from fractions import Fraction as F
from formats import q, choose, fields, chart, table, grid, item


def extension(s, l, n, v):
    a = 3 + n % 31
    b = 2 + n % 8
    k = 2 + n % 5
    if s in ("review.add", "review.subtract") and l == 1 and v == 2:
        a = 3 + n % 7
        b = 2 + n % 8
        if s == "review.add":
            return "bridge-ten", q(
                f"To add {a} + {b+8}, first make 10 from {a}. How many do you move from {b+8}?",
                10 - a,
            )
        return "subtract-ten", q(
            f"To subtract 9 from {a+b+10}, subtract 10 then add 1. What result do you get?",
            a + b + 1,
        )
    if s == "review.whole" and l == 1 and v == 2:
        return "related-division", q(
            f"{a} × {b} = {a*b}. Complete the related fact: {a*b} ÷ {b} = □.", a
        )
    if s == "review.conversions" and l == 1 and v == 2:
        return "decimal-to-fraction", q(
            f"Write {a/100:g} as a fraction.", F(a, 100), "fraction"
        )
    if s == "review.numberline" and l == 3 and v in (1, 2):
        x = (2 * (n % 8) + 1) * (-1 if n % 2 else 1)
        row = grid(
            f"Mark {str(F(x,2)) if v==1 else str(x/2)} on the number line.",
            x,
            0,
            18,
            "line",
        )
        row["control"]["step"] = 0.5
        row["answer"] = f"{x/2},0"
        return "fraction-line" if v == 1 else "decimal-line", row
    if s == "review.expressions" and l == 3 and v == 2:
        name = "Equation" if n % 2 else "Expression"
        expr = f"{a}x + {b}" + (f" = {a+b}" if n % 2 else "")
        return "expression-or-equation", choose(
            f"Classify {expr}.", name, ["Expression", "Equation"], n
        )
    if s == "review.coordinate" and l == 2 and v == 2:
        return "dependent-variable", choose(
            f"A tank fills at {a} L/min. A graph predicts liters from elapsed minutes. Which quantity depends on the other?",
            "Liters", ["Minutes"], n,
        )
    if s == "review.area" and l == 1 and v == 2:
        return "square", q(
            f"A square has side {a} cm. Area in square centimeters?", a * a
        )
    if s == "review.data":
        if l == 2 and v == 2:
            return "range", q(f"Find the range of {a}, {a+b}, {a+2*b}, {a+4*b}.", 4 * b)
        if l == 3 and v == 1:
            return "gap", q(
                "Which value in this dot plot has zero observations?",
                a + 2,
                visual=chart("dots", [1, 2, 0, 2, 1], [str(a + i) for i in range(5)]),
            )
        if l == 3 and v == 2:
            return "cluster", choose(
                f"Which interval contains most observations around {a+1}?",
                f"{a}–{a+2}",
                [f"{a+3}–{a+5}", f"{a+6}–{a+8}"],
                n,
                chart("dots", [4, 5, 4, 0, 0, 1], [str(a + i) for i in range(6)]),
            )
    if s == "number.sets" and l == 2 and v == 2:
        return "nested-diagram", choose(
            f"Use the diagram. Which set contains every integer, including −{a}?",
            "Rational numbers",
            ["Natural numbers", "Whole numbers"],
            n,
            dict(
                kind="sets",
                labels=[
                    "Rational numbers",
                    "Integers",
                    "Whole numbers",
                    "Natural numbers (1, 2, …)",
                ],
            ),
        )
    if s == "signed.add" and l == 3 and v == 0:
        pos = 1 + n % 9
        neg = 1 + n % 7
        return "integer-model", q(
            "Combine the positive and negative chips. What signed sum remains?",
            pos - neg,
            signed=True,
            visual=dict(kind="chips", values=[pos, neg]),
        )
    if s in ("signed.multiply", "signed.divide") and l == 2 and v == 2:
        groups, size = 2 + n % 5, 2 + n // 5 % 5
        total = -groups * size
        visual = dict(kind="signed-groups", values=[groups, size])
        if s == "signed.multiply":
            prompt = "Each group contains negative chips. Which multiplication shows the total?"
            correct, wrong = f"{groups} × (−{size}) = {total}", [f"{groups} × {size} = {-total}", f"{groups} + (−{size}) = {groups-size}"]
        else:
            prompt = "Share the pictured negative chips into the equal groups shown. Which division gives the signed amount per group?"
            correct, wrong = f"{total} ÷ {groups} = −{size}", [f"{-total} ÷ {groups} = {size}", f"{total} ÷ {groups} = {size}"]
        return "signed-groups", choose(prompt, correct, wrong, n, visual)
    if s == "number.context" and l == 3 and v == 2:
        return "guided-check", choose(
            f"A hiker starts at −{a} m, rises {a+b} m and reports {b} m. Which check supports that result?",
            f"{b} − {a+b} = −{a}",
            [f"{b} + {a+b} = −{a}", f"{b} × {a+b} = −{a}"],
            n,
        )
    if s == "ratio.equivalent" and l == 1 and v == 2:
        return "part-to-part", q(
            f"A bowl has {a*k} oranges and {b*k} pears. Find the number of oranges per pear.",
            F(a, b),
            "fraction",
        )
    if s == "ratio.represent" and l == 1 and v == 2:
        return "picture-model", q(
            f"The picture shows one tray. How many counters in {a} trays?",
            a * k,
            visual=dict(kind="counters", values=[k]),
        )
    if s == "ratio.represent" and l == 4 and v == 2:
        intercept = 0 if n % 2 else b
        return "test-proportionality", choose(
            f"Is the relationship through these points, including x = {a}, proportional?",
            "No" if intercept else "Yes",
            ["Yes", "No"],
            n,
            table(
                ["x", "y"], [(0, intercept), (1, k + intercept), (a, k * a + intercept)]
            ),
        )
    if s == "ratio.solve" and l == 3 and v == 2:
        return "interpret-units", choose(
            f"A printer makes {a*b} pages in {b} minutes. What does {a} represent?",
            "Pages per minute",
            ["Minutes per page", "Pages left"],
            n,
        )
    if s == "ratio.units" and l == 1 and v == 2:
        return "within-system", q(f"Use 1 yd = 3 ft. Convert {a} yd to feet.", a * 3)
    if s == "percent.multistep" and l == 1 and v == 2:
        return "percentage-points", q(
            f"A share rises from {a}% to {a+b}%. Find the increase in percentage points.",
            b,
        )
    if s == "similar.attributes" and l == 1 and v == 2:
        return "angle-agreement", q(
            f"△ABC ∼ △DEF. Angle B measures {a+b}°. Find angle E in degrees.", a + b
        )
    if s == "chance.space" and l == 2 and v == 2:
        coin_first = n % 4 >= 2
        first, second = ("H", "T") if n % 2 == 0 else ("T", "H")
        def outcome(side, flip=False):
            return f"{side}, {a}" if coin_first != flip else f"{a}, {side}"
        events = ("toss a coin, then roll a 36-sided die" if coin_first else
                  "roll a 36-sided die, then toss a coin")
        return "organized-list", fields(
            f"You {events}. The die shows {a}. List the two ordered outcomes. Enter {'heads' if first == 'H' else 'tails'} first.",
            ["First outcome", "Second outcome"],
            [outcome(first), outcome(second)],
            [[outcome(first, True), outcome(second)], [outcome(second, True), outcome(first)]],
            n,
            kind="list",
        )
    if s == "chance.simulate" and l == 1 and v == 2:
        return "physical-model", choose(
            f"A game wins with probability 1/{a}. Which bag models one round?",
            "1 red and " + str(a - 1) + " blue counters",
            ["1 red and " + str(a) + " blue counters", "Only red counters"],
            n,
        )
    if s == "chance.compare" and l == 2 and v == 2:
        return "sample-variation", choose(
            f"Two groups toss the same fair coin {a*2} times and get {a-1} and {a+1} heads. Why can results differ?",
            "Random samples can vary",
            ["A fair coin must alternate", "One coin must be unfair"],
            n,
        )
    if s == "stats.groups" and l == 3 and v == 2:
        return "different-scales", q(
            f"A dot plot for A runs from {a} to {a+4*b} in steps of {b}. B runs from {a} to {a+8*b} in steps of {2*b}. How much larger is B’s range?",
            4 * b,
        )
    if s == "stats.groups" and l == 2 and v == 2:
        return "support-comparison", choose(
            f"Sample medians are {a} for A and {a+b} for B. Which statement uses that evidence?",
            f"B has a median {b} higher",
            ["Every B value is greater", "A has a larger range"],
            n,
        )
    if s == "stats.populations" and l == 2 and v == 2:
        return "variability", choose(
            f"Two samples both have mean {a}. Their ranges are {b} and {b+k}. Which sample spans more values?",
            "Second sample",
            ["First sample", "Equal spans"],
            n,
        )
    if s == "linear.read" and l == 1 and v == 2:
        return "read-graph", q(
            f"Find the rate on this graph over the first {a} hours.",
            k,
            visual=dict(
                kind="plot",
                points=[[0, 0], [1, k], [a, a * k]],
                labels=["Hours", "Liters"],
            ),
        )
    if s == "linear.read" and l == 2 and v == 2:
        return "zero-intercept", q(
            f"A proportional tank model has {a*k} L after {a} hours. Find its initial liters.",
            0,
        )
    if s == "linear.represent" and l == 4 and v == 2:
        context, rate, initial = [
            (f"A taxi meter shows y = {k}x + {b} dollars after x miles.", "Dollars per mile", "Initial charge ($)"),
            (f"A tank holds y = {k}x + {b} liters after x minutes of filling.", "Liters per minute", "Initial volume (L)"),
            (f"A rental total is y = {k}x + {b} dollars after x hours.", "Dollars per hour", "Initial charge ($)"),
        ][n % 3]
        return "interpret-parameters", fields(
            f"{context} Complete the description.",
            [rate, initial],
            [k, b],
            [[k + 1, k + 2], [b + 1, b + 2]],
            n,
            kind="record",
        )
    if s == "linear.represent" and l == 2 and v == 2:
        k = 1 + n % 3
        b = n // 3 % 5
        return "construct-line", item(
            f"Graph y = {k}x + {b}. Plot the point at x = 0 first, then plot the point at x = 2.",
            f"0,{b};2,{2*k+b}",
            dict(kind="graph", limit=10, points=2),
        )
    if s == "algebra.check" and l == 1 and v == 2:
        rhs = F(a, 2) + b + (n % 2)
        return "rational-candidate", choose(
            f"Does x = {a}/2 satisfy x + {b} = {rhs}?",
            "No" if n % 2 else "Yes",
            ["Yes", "No"],
            n,
        )
    if s == "algebra.graph" and l == 3 and v == 2:
        x = F(2 * (n % 9) - 7, 2)
        return "rational-boundary", fields(
            f"Solve 2x + {b} ≥ {2*x+b}, then graph the solution set.",
            ["Boundary", "Endpoint", "Ray"],
            [str(x), "Closed", "Right"],
            [[str(x - 1), str(x + 1)], ["Open"], ["Left"]],
            n,
            kind="ray",
        )
    if s == "circle.pi" and l == 1 and v == 2:
        return "estimate-circumference", q(
            f"Estimate circumference for diameter {a} cm using π ≈ 3.", 3 * a
        )
    if s == "circle.pi" and l == 2 and v == 2:
        return "area-model", choose(
            f"A circle of radius {a} is cut into sectors. Rearranged into a near-rectangle of height {a}, what is the approximate base?",
            f"{a}π",
            [f"{2*a}π", f"{a*a}π"],
            n,
        )
    if s == "area.composite":
        if l == 2 and v == 2:
            return "parallelogram", q(
                f"A parallelogram with base {a} and perpendicular height {b} joins a square with side {k}. Total area?",
                a * b + k * k,
            )
        if l == 4 and v == 2:
            return "quarter-circle", q(
                f"A square with side {2*a} has a quarter circle of radius {a} removed. Use π = 3.14. Remaining area?",
                4 * a * a - F(314 * a * a, 400),
                "decimal",
            )
        if l == 5 and v == 2:
            return "missing-dimension", q(
                f"A rectangular region has area {a*b} and width {b}. A square of side {k} extends its length. Find the combined end-to-end length.",
                a + k,
            )
    if s == "solid.pyramid" and l == 3 and v == 2:
        return "perpendicular-height", q(
            f"A pyramid has base area {a*3}, perpendicular height {b} and slant height {b+k}. Find its volume.",
            a * b,
        )
    if s == "solid.nets" and l >= 3 and v == 2:
        return "face-height", q(
            f'A triangular face of a {"rectangular" if l==3 else "triangular"} pyramid net has base {a*2} cm and perpendicular face height {b} cm. Area in cm²?',
            a * b,
        )
    if s == "solid.surface" and l == 1 and v == 2:
        return "covering-or-capacity", choose(
            f"Which quantity gives the wrapping paper needed for all faces of a {a} × {b} × {k} box?",
            "Total surface area",
            ["Volume", "Base perimeter"],
            n,
        )
    if s == "finance.budget" and l == 2 and v in (1, 2):
        return ("college-saving" if v == 1 else "tax-share"), q(
            f'Out of ${a*100} income, ${a*b} goes to {"college savings" if v==1 else "taxes"}. What percent of income is this?',
            b,
        )
    if s == "finance.deals" and l == 3 and v == 2:
        return "compare-incentives", q(
            f"A ${a*100} bike has two offers: {b}% off, or ${a*b+k} off. How much lower is the cheaper final price?",
            k,
        )
    return None
