"""Practice forms for the standard sixth-grade course."""

from fractions import Fraction as F
from math import lcm
from random import Random
from formats import q, choose, fields, chart, table, item, grid


def problem(slug, seed):
    n, v = 2 + seed // 3, seed % 3
    k = 2 + (5 * n + v) % 7

    def pick(prompt, correct, others, visual=None):
        return choose(prompt, correct, others, Random(f"{slug}:{seed}").randrange(60), visual)

    if slug == "sets":
        opts = ["Whole numbers", "Integers", "Rational numbers"]
        value = [str(n * n), f"−{n}", f"{n}/{n+1}"][v]
        return pick(
            f"Find the smallest pictured set containing {value}.",
            opts[v],
            opts,
            dict(kind="sets", labels=["Rational numbers", "Integers", "Whole numbers"]),
        )
    if slug == "opposites":
        if v == 0:
            return q(
                f"A submarine is at −{n*5} m. Find its absolute distance from sea level in meters.",
                n * 5,
            )
        if v == 1:
            return q(
                f"What is the opposite of a gain of {2*n} points? Use a signed number.",
                -2 * n,
            )
        return q(f"What is the opposite of −{n}.5?", F(2 * n + 1, 2), "decimal")
    if slug == "quotients":
        if v == 0:
            return q(
                f"{n} cakes are shared equally among {n+3} children. What fraction of a cake does each get?",
                F(n, n + 3),
            )
        if v == 1:
            return pick(
                f"Which division represents {n+5}/{n}?",
                f"{n+5} ÷ {n}",
                [f"{n} ÷ {n+5}", f"{n+5} × {n}"],
            )
        return q(
            f"A ribbon {n+1} m long is split into {2*n} equal lengths. Find each length in meters.",
            F(n + 1, 2 * n),
        )
    if slug == "order":
        if v == 0:
            return item(
                f"Mark −{n-1}.5 on the number line.",
                f"-{n-1}.5,0",
                dict(kind="line", step=0.5, limit=18),
            )
        if v == 1:
            return pick(
                f"Which depth is lowest relative to the surface: −{n}.4, −{n}.8 or −{n} meters?",
                f"−{n}.8",
                [f"−{n}.4", f"−{n}"],
            )
        a, b, c = f"−{n}/2", "0", f"{n}/4"
        return pick(
            f"Order {c}, {a} and {b} from least to greatest.",
            f"{a}, {b}, {c}",
            [f"{c}, {b}, {a}", f"{b}, {a}, {c}"],
        )
    if slug == "add":
        if v == 0:
            return q(
                "Cancel zero pairs. What signed number remains?",
                n - k,
                visual=dict(kind="chips", values=[n, k]),
            )
        if v == 1:
            return q(
                f"Start at −{n} and move {2*n+1} units right. Where do you land?", n + 1
            )
        return q(
            f"The morning temperature was −{n+2}°. The evening temperature was −{k}°. Find evening minus morning.",
            n + 2 - k,
        )
    if slug == "multiply":
        if v == 0:
            return q(
                f"A diver drops {n} meters each minute for {k} minutes. Give the signed change.",
                -n * k,
            )
        if v == 1:
            return q(f"(−{n*k}) ÷ (−{k})", n)
        return q(f"(−{n}) × (−{k})", n * k)
    if slug == "factors":
        if v == 0:
            return q(f"Find the greatest common factor of {3*n} and {5*n}.", n)
        if v == 1:
            return q(
                f"One bell rings every {n} minutes and another every {n+2}. They ring together now. Minutes until they next coincide?",
                lcm(n, n + 2),
            )
        return q(
            f"In the prime factorization of {3*2**n}, what exponent belongs on 2?", n
        )
    if slug == "fraction-products":
        if v == 0:
            return q(f"Find {n}/{n+1} × {n+1}/{n+3} in simplest form.", F(n, n + 3))
        if v == 1:
            return pick(
                f"A positive length is multiplied by {n+1}/{n}. How does its size change?",
                "It increases",
                ["It stays equal", "It decreases"],
            )
        return q(
            f"A garden covers {n} 1/2 m². Herbs fill two thirds. How many square meters are herbs?",
            F(2 * n + 1, 3),
        )
    if slug == "fraction-division":
        if v == 0:
            return q(f"How many 1/{n}-liter bottles fill a {k}-liter bucket?", n * k)
        if v == 1:
            return pick(
                f"Which product equals {n}/3 divided by {k}/5?",
                f"({n}/3) × (5/{k})",
                [f"({n}/3) + ({k}/5)", f"({n}/3) − (5/{k})"],
            )
        return q(
            f"A {n}/2 m strip is cut into pieces of length 3/4 m. Express the length ratio as a simplified number.",
            F(2 * n, 3),
        )
    if slug == "decimals":
        if v == 0:
            return q(f"Find {n}.25 × 1.2.", F(4 * n + 1, 4) * F(6, 5), "decimal")
        if v == 1:
            return q(
                f"A pack costs ${n*(1+k/4):.2f} for {n} items. Find the unit price in dollars.",
                F(4 + k, 4),
                "decimal",
            )
        return q(
            f"A wire {1.25*n:.2f} m long contains how many 0.25 m segments?", 5 * n
        )
    if slug == "ratios":
        if v == 0:
            return q(
                f"Paint uses {n} measures of blue for 3 of yellow. How many blue measures go with 12 yellow?",
                4 * n,
            )
        if v == 1:
            return pick(
                f"A basket holds {n} red and {n+2} green apples. Which ratio compares red to all apples?",
                f"{n} to {2*n+2}",
                [f"{n} to {n+2}", f"{n+2} to {n}"],
            )
        return q(
            "Complete the last entry in this equivalent-ratio table.",
            n * 5,
            visual=table(["Batches", "Oat cups"], [(1, n), (3, n * 3), (5, "?")]),
        )
    if slug == "rates":
        if v == 0:
            return q(
                f"A cyclist covers {n*k} miles in {k} hours. Find miles per hour.", n
            )
        if v == 1:
            return q(
                f"Three pens cost ${3*n}. Five cost ${5*(n+1)} at another store. How many dollars per pen at the cheaper store?",
                n,
            )
        return q(
            f"A pipe delivers {n*2} liters in 2 minutes. How many liters will it deliver in {k+2} minutes?",
            n * (k + 2),
        )
    if slug == "convert":
        if v == 0:
            return q(f"Convert {n}.5 meters to centimeters.", 100 * n + 50)
        if v == 1:
            return q(
                f"A jug holds {4*n+2} cups. Use 4 cups per quart. How many quarts?",
                F(2 * n + 1, 2),
                "decimal",
            )
        return q(
            f"A delivery travels {n*5280} feet. At 5280 feet per mile, how many miles is that?",
            n,
        )
    if slug == "percent-models":
        if v == 0:
            return q(
                "What percent of the hundred grid is shaded?",
                n * 5,
                visual=dict(kind="hundred", values=[n * 5]),
            )
        if v == 1:
            return q(f"Write {n*10}% as a decimal.", F(n, 10), "decimal")
        return q(
            f"One third of a ${3*n} allowance is saved. At 33⅓%, how many dollars are saved?",
            n,
        )
    if slug == "percent":
        if v == 0:
            return q(f"What is 25% of {8*n} books?", 2 * n)
        if v == 1:
            return q(
                f"{k*n} seats are occupied out of {10*n}. What percent are occupied?",
                10 * k,
            )
        return q(
            f"{2*n} votes represent 20% of the total. How many votes were cast?", 10 * n
        )
    if slug == "powers":
        if v == 0:
            return q(f"Evaluate {n} + 2³ × {k}.", n + 8 * k)
        if v == 1:
            return q(f"Evaluate ({n} + {k})² − {n}.", (n + k) ** 2 - n)
        return q(f"Evaluate {n*n} ÷ {n} + {k}².", n + k * k)
    if slug == "expressions":
        if v == 0:
            return q(f"Find 3a + {n} when a = {k}.", 3 * k + n)
        if v == 1:
            return pick(
                f"Which is an equation about a number x and {n}?",
                f"x + {n} = {2*n}",
                [f"x + {n}", f"{n}x"],
            )
        return pick(
            f"Which expression means {n} less than twice a number?",
            f"2x − {n}",
            [f"{n} − 2x", f"2(x + {n})"],
        )
    if slug == "properties":
        if v == 0:
            return q(f"Complete {n}(x + {k}) = {n}x + □.", n * k)
        if v == 1:
            return q(f"Combine {n}x + {k}x. What is the coefficient of x?", n + k)
        identities = [
            (f"{n} + 0 = {n}", "Identity"),
            (f"{n} + (−{n}) = 0", "Inverse"),
            (f"{n} + 4 = 4 + {n}", "Commutative"),
            (f"({n} + 2) + 3 = {n} + (2 + 3)", "Associative"),
        ]
        eq, ans = identities[n % 4]
        return pick(
            f"Which property is illustrated by {eq}?", ans, [p for _, p in identities]
        )
    if slug == "coordinates":
        x, y = [(-n, k), (k, -n), (-n, -k) if n % 2 else (n, k)][v]
        if v == 2:
            x = x / 2
            y = y / 2
            return item(
                f"Plot ({x:g}, {y:g}) in the coordinate plane.",
                f"{x:g},{y:g}",
                dict(kind="graph", step=0.5, limit=10),
            )
        return grid(f"Plot ({x}, {y}).", x, y)
    if slug == "rules":
        if v == 0:
            return q(f"At x = {n}, how much larger is 5x than x + 2?", 4 * n - 2)
        if v == 1:
            return pick(
                "Which rule fits the table?",
                f"y = {n}x",
                [f"y = x + {n}", f"y = x − {n}"],
                table(["x", "y"], [(0, 0), (1, n), (2, 2 * n)]),
            )
        return pick(
            f"Which graph description fits y = x + {n}?",
            f"It passes through (0, {n}) and (1, {n+1})",
            [f"It goes through (0, 0) and (1, {n})", "It falls as x increases"],
        )
    if slug == "variables":
        vis = table(["Days", "Pages"], [(1, n), (2, n * 2), (3, n * 3)])
        if v == 0:
            return pick(
                "At a fixed reading rate, which quantity depends on days spent reading?",
                "Pages read",
                ["Days spent reading", "Number of pages in an unopened book"],
                vis,
            )
        if v == 1:
            return q("Write pages = k × days for the table. Find k.", n, visual=vis)
        return grid(f"Plot the point with x = 1 in y = x + {n}.", 1, 1 + n)
    if slug == "write-equations":
        if v == 0:
            return pick(
                f"A lunch and a ${n} drink together cost ${3*n}. Choose the equation for lunch price x.",
                f"x + {n} = {3*n}",
                [f"{n}x = {3*n}", f"x − {n} = {3*n}"],
            )
        if v == 1:
            return pick(
                f"Which story represents {n}x = {5*n}?",
                f"Buying {n} tickets at x dollars each costs ${5*n}",
                [
                    f"${n} is added to a balance",
                    "A discount is subtracted from one price",
                ],
            )
        return fields(
            f"Build a story for x − {n} = {k}.",
            ["Starting amount", "Action", "Result"],
            ["Unknown", f"Spend ${n}", f"${k} remains"],
            [[f"${n}"], [f"Earn ${n}"], [f"${k} was spent"]],
            seed,
            kind="story",
        )
    if slug == "solve":
        if v == 0:
            return q(f"Solve x − {n} = −{n+k}.", -k)
        if v == 1:
            return q(f"A rectangle of width {n} has area {n*k}. Find its length.", k)
        valid = n % 2 == 0
        return pick(
            f"Does x = {n} solve x/2 = {float(F(n,2))+(0 if valid else 1):g}?",
            "Yes" if valid else "No",
            ["Yes", "No"],
        )
    if slug == "inequalities":
        if v == 0:
            return q(
                f"A box weighs {n} kg empty and may weigh at most {4*n} kg when full. Maximum load in kg?",
                3 * n,
            )
        if v == 1:
            return fields(
                f"Graph x + 2 > {n+2} on a number line.",
                ["Boundary", "Endpoint", "Shade"],
                [n, "Open", "Right"],
                [[n + 2, n + 4], ["Closed"], ["Left"]],
                seed,
                kind="ray",
            )
        return pick(
            f"Choose a situation modeled by {n}x ≤ {5*n}.",
            f"Buy x tickets at ${n} each with a budget of at most ${5*n}",
            [
                f"Buy x tickets at ${n} each and spend more than ${5*n}",
                f"Spend exactly ${5*n} on one ticket",
            ],
        )
    if slug == "triangles":
        if v == 0:
            return q(
                f"Two angles are {30+n}° and {45+n}°. Find the third angle.",
                105 - 2 * n,
            )
        if v == 1:
            c = 3 * n + (0 if n % 2 else -1)
            return pick(
                f"Can {n}, {2*n}, {c} be the sides of a triangle?",
                "Yes" if c < 3 * n else "No",
                ["Yes", "No"],
            )
        return pick(
            f"Triangle sides AB, BC and CA measure {n+2}, {n+3} and {n+4}. Which angle is largest?",
            "B",
            ["A", "C"],
        )
    if slug == "area":
        if v == 0:
            return q(
                f"A triangle has base {2*n} and perpendicular height {k}. Find its area.",
                n * k,
            )
        if v == 1:
            return q(
                f"A parallelogram is cut and slid into a rectangle of base {n}.5 and height 4. What is its area?",
                4 * n + 2,
            )
        return pick(
            f"A triangle is half a parallelogram with base b and height {n}. Choose its area equation.",
            f"A = b × {n} ÷ 2",
            [f"A = b × {n}", f"A = b + {n}"],
        )
    if slug == "trapezoids":
        if v == 0:
            return q(
                f"A trapezoid has bases {n} and {n+2} and height {k}. Find its area.",
                (n + 1) * k,
            )
        if v == 1:
            return q(
                f"A {n} by {k} rectangle shares its base of length {n} with a nonoverlapping triangle of height 2. Find their total area.",
                n * (k + 1),
            )
        return q(
            f"A trapezoid has height 4 and area {4*(n+2)}. One base is {n}. Find the other base.",
            n + 4,
        )
    if slug == "prisms":
        if v == 0:
            return q(
                f"A box is {n}.5 cm long, 4 cm wide and {k} cm high. Find cubic centimeters.",
                (4 * n + 2) * k,
            )
        if v == 1:
            return q(
                f"A prism has volume {6*n} m³ and base area 6 m². Find its height.", n
            )
        return pick(
            f"A rectangular prism has sides a, {n} and {k}. Choose its volume formula.",
            f"V = {n*k}a",
            [f"V = a + {n+k}", f"V = 2a + {n*k}"],
        )
    if slug == "questions":
        if v == 0:
            return pick(
                f"A class has {n+10} students. Which survey question anticipates variation?",
                "How many minutes did each student read yesterday?",
                [
                    "What is this class's assigned room number?",
                    "How many students are on this class roster?",
                ],
            )
        if v == 1:
            return pick(
                f"{n} identical unopened packs have exactly 12 pencils each. Which measurement will vary across their owners?",
                "Minutes each owner spends writing",
                ["Pencils per unopened pack", "Dozens in each pack"],
            )
        return pick(
            f"One class recorded {n} leaves on a plant. Which set of counts shows variability?",
            f"{n}, {n+1}, {n}",
            [f"{n}, {n}, {n}", f"{n+1}, {n+1}, {n+1}"],
        )
    if slug == "dot-stem":
        if v == 0:
            return q(
                "How many observations does this dot plot show?",
                n + 4,
                visual=chart("dots", [2, n, 2], ["4", "5", "6"]),
            )
        if v == 1:
            return q(
                "Read the greatest observation. Key: 2 | 3 represents 23.",
                10 * n + 7,
                visual=table(["Stem", "Leaves"], [(n - 1, "1 3"), (n, "2 5 7")]),
            )
        return fields(
            f"Make a dot plot for {n}, {n}, {n+1}, {n+2}, {n+2}, {n+2}.",
            [f"Dots over {n}", f"Dots over {n+1}", f"Dots over {n+2}"],
            [2, 1, 3],
            [[1, 3], [2, 3], [1, 2]],
            seed,
        )
    if slug == "histograms":
        if v == 0:
            return q(
                "How many observations are at least 10?",
                n + k,
                visual=chart("histogram", [3, n, k], ["0–9", "10–19", "20–29"]),
            )
        if v == 1:
            return q(
                f"Group these ages into 10-year bins: {n}, {n+10}, {n+11}, {n+20}. How many are from 10 through 19, inclusive?",
                2 if n < 9 else 1,
            )
        return pick(
            "Which interval contains the most observations?",
            "10–19",
            ["0–9", "20–29"],
            chart("histogram", [n, n + 2, n - 1], ["0–9", "10–19", "20–29"]),
        )
    if slug == "center":
        if v == 0:
            return q(f"Find the mean of {n}, {n+5} and {n+7}.", n + 4)
        if v == 1:
            return q(f"Find the median of {n+8}, {n}, {n+2} and {n+4}.", n + 3)
        return pick(
            f"In {n}, {n}, {n+1}, {n+2}, {10*n}, which measure better describes a typical value?",
            "Median, because the largest value pulls up the mean",
            [
                "Mean, because the largest value has no effect",
                "Range, because it is a measure of center",
            ],
        )
    if slug == "spread":
        five = [n, n + 2, n + 4, n + 7, n + 10 + k]
        if v == 0:
            return q(
                "Find the range of the plotted data.",
                five[4] - n,
                visual=dict(kind="boxes", labels=["Scores"], rows=[five]),
            )
        if v == 1:
            return q(
                f"Five-number summary: {n}, {n+2}, {n+4}, {n+5+k}, {n+10+k}. Find the IQR.",
                3 + k,
            )
        return fields(
            f"For {n}, {n+2}, {n+4}, {n+6}, {n+8}, {n+10}, choose the two box edges.",
            ["Q1", "Q3"],
            [n + 2, n + 8],
            [[n, n + 4], [n + 6, n + 10]],
            seed,
        )
    if slug == "categories":
        vals = [2 * n, 3 * n, 5 * n]
        labels = ["Art", "Band", "Sports"]
        if v == 0:
            return pick(
                "Which club is the mode?",
                "Sports",
                ["Art", "Band"],
                table(["Club", "Votes"], list(zip(labels, vals))),
            )
        if v == 1:
            return q(
                f"A class of {10*n} students votes: {2*n} art, {3*n} band, {5*n} sports. What percent chose band?",
                30,
            )
        return q(
            f"The percent bar summarizes {10*n} votes. How many students voted for sports?",
            k * n,
            visual=chart("percent-bar", [10, 90 - k * 10, k * 10], labels),
        )
    if slug == "accounts":
        if v == 0:
            return q(
                f"Bank A charges ${n} monthly. Bank B charges $1 plus $2 per out-of-network withdrawal. With {n} such withdrawals, how much cheaper is A?",
                n + 1,
            )
        if v == 1:
            return q(
                f"A fee-free debit purchase of ${n*4} comes from a ${n*12} checking balance. What remains?",
                8 * n,
            )
        return pick(
            f"Which way to pay a ${5*n} bill borrows funds until repayment?",
            "Credit card",
            ["Debit card", "Cash from checking"],
        )
    if slug == "register":
        if v == 0:
            return q(
                f"Start with ${10*n}. Deposit ${3*n}, withdraw ${2*n} and transfer $5 out. Ending balance?",
                11 * n - 5,
            )
        if v == 1:
            return q(
                "What checking balance follows the final transaction?",
                9 * n,
                visual=table(
                    ["Entry", "Dollars"],
                    [
                        ("Opening", 10 * n),
                        ("Deposit", 2 * n),
                        ("Transfer to savings", -3 * n),
                    ],
                ),
            )
        return q(
            f"Your register shows ${13*n}. An unrecorded debit of ${n}.50 cleared. Find the corrected balance in dollars.",
            F(24 * n - 1, 2),
            "decimal",
        )
    if slug == "credit":
        if v == 0:
            return pick(
                f"A credit report lists {n} loan payments made on time. What does that tell a lender?",
                "How the borrower has repaid debt",
                [
                    "How much cash is in the borrower's wallet",
                    "The borrower's guaranteed future earnings",
                ],
            )
        if v == 1:
            return pick(
                f"A borrower finds a ${100*n} debt they do not recognize on a credit report. How can reviewing the report help?",
                "It lets the borrower identify and dispute potential errors",
                [
                    "It automatically deletes all accurate debt",
                    "It adds money to a checking account",
                ],
            )
        years, record = (
            (7, "most negative payment information")
            if n % 2 == 0
            else (10, "a bankruptcy")
        )
        return q(
            f"For a U.S. credit report, use the general maximum of {years} years for {record}. Counting from a reporting-period start in {2010+n}, in what year would that period end?",
            2010 + n + years,
        )
    if slug == "college":
        if v == 0:
            return q(
                f"A program costs ${1000*n}. A grant pays ${300*n}, and savings pay ${200*n}. How much is still needed?",
                500 * n,
            )
        if v == 1:
            return pick(
                f"Which way to fund a ${100*n} course involves earning money by working in an eligible job?",
                "Work-study",
                ["Student loan", "Merit scholarship"],
            )
        return pick(
            f"A student has ${100*n} in scholarships and borrows ${50*n} in loans. Which portion normally requires repayment?",
            f"The ${50*n} loan",
            [f"The ${100*n} scholarship", "Both portions are wages"],
        )
    if slug == "income":
        if v == 0:
            return q(
                f"In a model, a trained technician earns ${40000+1000*n} annually and an assistant earns $40000. With constant salaries, find the difference over 30 working years.",
                30000 * n,
            )
        if v == 1:
            return q(
                f"Compare ${30000+1000*n} per year for 30 years with $30000 per year for 30 years. If the first path costs ${2000*n} more in training, find its net lifetime advantage.",
                28000 * n,
            )
        return q(
            f"A training program costs ${3000*n} and raises annual pay by $3000. How many working years until extra pay covers the cost?",
            n,
        )
    if slug == "fluency":
        if v == 0:
            return q(f"Divide {((100+n*3)*(12+k))} by {12+k}.", 100 + n * 3)
        if v == 1:
            return q(
                f"Combine {n}.46 kg of rice with {k}.78 kg. Find the total in kilograms.",
                F(100 * (n + k) + 124, 100),
                "decimal",
            )
        return q(
            f"A bolt is {2*n}.25 m long. How many meters remain after cutting {n}.87 m?",
            F(n * 100 - 62, 100),
            "decimal",
        )
    if slug == "polygons":
        if v == 0:
            return q(
                f"A rectangle has vertices (−{n}, 1), ({k}, 1), ({k}, 4) and (−{n}, 4). What is its perimeter?",
                2 * (n + k + 3),
            )
        if v == 1:
            return q(
                f"A triangle has vertices (0, −{n}), (0, {k}) and (4, {k}). Find its area in square units.",
                2 * (n + k),
            )
        return grid(
            f"A rectangle has three corners (−{n}, −2), ({k}, −2), and ({k}, 4). Plot its fourth corner.",
            -n,
            4,
        )
    if slug == "nets":
        if v == 0:
            return q(
                "The net labels each face with its area. Find the total surface area.",
                2 * (n * 2 + k * 2 + n * k),
                visual=dict(
                    kind="net",
                    solid=1,
                    values=[2 * n, 2 * n, 2 * k, n * k, 2 * k, n * k],
                ),
            )
        if v == 1:
            return q(
                f"An open-top cube has side length {n} cm. How many square centimeters of cardboard form the bottom and four sides?",
                5 * n * n,
            )
        return q(
            "A square pyramid unfolds into this net. Find its surface area in square units.",
            (2 * n) ** 2 + 4 * n * (n + k),
            visual=dict(kind="net", solid=3, values=[(2 * n) ** 2] + [n * (n + k)] * 4),
        )
    if slug == "deviation":
        if v == 0:
            return q(
                f"The mean of {n}, {n+4}, {n+8}, and {n+12} is {n+6}. What is the mean absolute deviation?",
                4,
            )
        if v == 1:
            return q(
                f"Distances from a data set's mean are {n}, {k}, {n}, and {k}. Find their average.",
                F(n + k, 2),
                "decimal",
            )
        counts = [n, n + 2, n + 4, n + 2, n] if n % 2 else [n + 4, n + 2, n, 1, 1]
        return pick(
            "Which description matches the pattern of frequencies?",
            (
                "Symmetric with a central peak"
                if n % 2
                else "Most observations lie in the lower intervals"
            ),
            [
                "Symmetric with a central peak",
                "Most observations lie in the lower intervals",
                "The middle interval is empty",
            ],
            chart("histogram", counts, ["0–9", "10–19", "20–29", "30–39", "40–49"]),
        )
    raise ValueError(slug)
