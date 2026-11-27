"""Practice for individual steps that are specific to the Grade 6 progression."""

from fractions import Fraction as F
from random import Random
from formats import q, choose, fields, grid, chart, table


def problem(key, seed):
    # Permutations keep small values distinct across a pool and avoid ascending runs.
    n = 3 + (11 * seed) % 29
    k = 2 + (7 * seed) % 9
    v = seed % 3
    rng = Random(f"{key}/{seed}")

    def pick(prompt, answer, *options, visual=None):
        return choose(prompt, answer, options, rng.randrange(6), visual)

    if key == "signed-position":
        context, sign = [
            ("meters below a trailhead", -1),
            ("meters above sea level", 1),
            ("points behind the leader", -1),
        ][v]
        return q(
            f"Give the signed position for {n} {context}, using the reference as zero.",
            sign * n,
        )
    if key == "opposite-point":
        x = (n if v == 0 else -n) * (F(1, 2) if v == 2 else 1)
        return q(f"A point sits at {x}. Where is its reflection across zero?", -x)
    if key == "share":
        thing, unit = [
            ("loaves", "loaves"),
            ("pizzas", "pizzas"),
            ("meters of ribbon", "meters of ribbon"),
        ][v]
        return q(
            f"{n} {thing} are divided equally among {k} students. How many {unit} does each receive?",
            F(n, k),
        )
    if key == "fraction-bar":
        if v == 1:
            return q(
                f"In the division represented by {n}/{k}, which number is the divisor?",
                k,
            )
        if v == 2:
            return q(
                f"In the division represented by {k}/{n}, which number is being divided?",
                k,
            )
        return pick(
            f"Which operation gives the value of {n}/{k}?",
            f"{n} ÷ {k}",
            f"{n} × {k}",
            f"{n} + {k}",
        )
    if key == "scale-share":
        return q(
            f"{k} campers share {n} flatbreads. How many flatbreads give {k*(2+v)} campers the same share?",
            n * (2 + v),
        )
    if key == "prime-power":
        p, exp = [2, 3, 5][v], 2 + seed // 3 % 4
        other = [7, 11, 13, 17, 19, 23, 29, 31][seed // 3]
        return q(
            f"What exponent belongs on {p} in the prime factorization of {p**exp * other}?",
            exp,
        )
    if key == "scale-product":
        scale = [F(3, 4), F(5, 4), F(2, 3)][v]
        return q(
            f"A full recipe uses {n*scale.denominator} grams of spice. How many grams does {scale} of a recipe use?",
            n * scale.numerator,
        )
    if key == "reciprocal":
        return q(f"Complete the product: {n}/{n+k} × □ = 1.", F(n + k, n))
    if key == "division-check":
        proposed = n + 20 + (1 if v == 1 else 0)
        dividend = (n + 20) * (k + 10)
        if v == 0:
            return q(
                f"To check {dividend} ÷ {k+10} = {proposed}, multiply the divisor by the proposed quotient. What product should you compare to the dividend?",
                (k + 10) * proposed,
            )
        if v == 1:
            return q(
                f"A student claims {dividend} ÷ {k+10} = {proposed}. By how much does the check product exceed the dividend?",
                (k + 10) * proposed - dividend,
            )
        return q(
            f"A student checks {dividend} ÷ {k+10} by multiplying {k+10} × □ = {dividend}. Find the missing quotient.",
            proposed,
        )
    if key == "metric":
        if v == 0:
            return q(f"Convert {n}.5 m to centimeters.", 100 * n + 50)
        if v == 1:
            return q(
                f"Convert {n*100+25} mL to liters.", F(n * 100 + 25, 1000), "decimal"
            )
        return q(f"Convert {n}.75 kg to grams.", n * 1000 + 750)
    if key == "customary":
        if v == 0:
            return q(f"How many cups are in {n} pints? Use 2 cups per pint.", 2 * n)
        if v == 1:
            return q(
                f"How many yards equal {3*n+1} feet? Use 3 feet per yard.",
                F(3 * n + 1, 3),
            )
        return q(
            f"How many pints are in {n} gallons? Each gallon is 4 quarts and each quart is 2 pints.",
            8 * n,
        )
    if key == "grid-percent":
        shaded = 5 + (17 * seed) % 91
        if v == 0:
            return q("What percent of the hundred grid is shaded?", shaded,
                     visual=dict(kind="hundred", values=[shaded]))
        if v == 1:
            shaded = [25, 50, 75, 10, 20, 30, 40, 60][seed // 3]
            parts = 4 if shaded % 25 == 0 else 10
            return q("What percent of the strip is shaded?", shaded,
                     visual=dict(kind="benchmark-percent", values=[parts, shaded * parts // 100]))
        parts = [3, 3, 3, 4, 4, 4, 10, 10][seed // 3]
        mark = [1, 2, 3, 1, 2, 3, 1, 7][seed // 3]
        pct = F(100 * mark, parts)
        if pct.denominator == 3:
            label = f"{float(pct):.2f}%"
            return pick("What percent is marked on the number line? Round to the nearest hundredth of a percent.", label,
                        "10%", "50%", "100%", visual=dict(kind="benchmark-percent", labels=["line"], values=[parts, mark]))
        return pick("What percent is marked on the number line?", f"{pct}%", "10%", "50%", "100%", visual=
                    dict(kind="benchmark-percent", labels=["line"], values=[parts, mark]))
    if key == "power-base":
        copies = 2 + seed % 4
        expression = " × ".join([str(n)] * copies)
        return q(
            f"When {expression} is written as a power, what is the {'base' if v==0 else 'exponent'}?",
            n if v == 0 else copies,
        )
    if key == "power-value":
        return q(f"Evaluate {n}{'²' if v==0 else '³'}.", n ** (2 if v == 0 else 3))
    if key == "term":
        expression = [f"{n}x + {k}", f"{k} + {n}x", f"{n}y − {k}"][v]
        return q(
            f"In {expression}, what is the {'constant term' if v==1 else 'coefficient of the variable'}?",
            k if v == 1 else n,
        )
    if key == "translate":
        if v == 0:
            return pick(
                f"Which expression means {n} fewer than {k} times x?",
                f"{k}x − {n}",
                f"{n} − {k}x",
                f"{k}x + {n}",
            )
        if v == 1:
            return pick(
                f"Which expression means {k} times the sum of x and {n}?",
                f"{k}(x + {n})",
                f"{k}x + {n}",
                f"x + {k*n}",
            )
        return pick(
            f"Which expression means x shared among {k} groups, then increased by {n}?",
            f"x/{k} + {n}",
            f"x/({k} + {n})",
            f"{k}x + {n}",
        )
    if key == "identify-property":
        names = ["Commutative", "Associative", "Identity", "Inverse"]
        equations = [
            f"{n} + {k} = {k} + {n}",
            f"({n} + 1) + {k} = {n} + (1 + {k})",
            f"{n} + 0 = {n}",
            f"{n} + (−{n}) = 0",
        ]
        i = seed % 4
        return pick(f"Which property explains {equations[i]}?", names[i], *names)
    # Distinct points within the interactive graph's reachable range.
    x, y = 1 + seed // 4, 1 + seed % 4
    if key == "scaled-axes":
        minutes_per_tick = [2, 3, 5][v]
        liters_per_tick = n + 2
        tick = 1 + seed % 3
        minutes, liters = tick * minutes_per_tick, tick * liters_per_tick
        return q(
            f"Read the volume when the time is {minutes} minutes. Give the answer in liters.",
            liters,
            visual=dict(kind="scaled-axis", labels=["Minutes", "Liters"],
                        values=[minutes_per_tick, liters_per_tick], points=[[minutes, liters]]),
        )
    if key == "mirror-axis":
        axis = "x" if seed % 2 else "y"
        return grid(
            f"Reflect (−{x}, {y}) across the {axis}-axis. Plot its image.",
            -x if axis == "x" else x,
            -y if axis == "x" else y,
        )
    if key == "additive":
        change = n if v != 1 else -n
        return q(
            "The rule adds a constant to each input. Find that signed constant.",
            change,
            visual=table(
                ["Input", "Output"], [(k, k + change), (k + 3, k + 3 + change)]
            ),
        )
    if key == "compare-rules":
        return q(
            f"At input {n}, one rule adds {k} and the other multiplies by {k}. What is the distance between the two outputs?",
            abs(n + k - n * k),
        )
    if key == "depend":
        driver, result, context = [
            ("Time", "Water collected", f"A tap adds {n} liters every minute"),
            ("Number of tickets", "Total price", f"Identical tickets cost ${n} each"),
            ("Days", "Distance traveled", f"A walker covers {n} km per day"),
        ][v]
        return pick(
            f"{context}. Which is the {'independent' if seed%2 else 'dependent'} variable?",
            driver if seed % 2 else result,
            driver,
            result,
        )
    if key == "add-story":
        if v == 1:
            return pick(
                f"Start with x points. Lose {n} and finish with {k}. Choose the equation.",
                f"x − {n} = {k}",
                f"x + {n} = {k}",
                f"{n} − x = {k}",
            )
        return pick(
            f"A bin starts with x books. After adding {n}, it holds {n+k}. Choose the equation.",
            f"x + {n} = {n+k}",
            f"x − {n} = {n+k}",
            f"{n}x = {n+k}",
        )
    if key == "mult-story":
        return pick(
            f"{k} equal packs contain {n*k} tiles altogether. Choose the equation for x tiles per pack.",
            f"{k}x = {n*k}",
            f"x + {k} = {n*k}",
            f"x/{k} = {n*k}",
        )
    if key == "inverse-story":
        if v == 1:
            return pick(
                f"Which story fits x − {n} = {k}?",
                f"Give away {n} of x cards and keep {k}",
                f"Add {n} cards to x and get {k}",
                f"Split x cards into {n} packs of {k}",
            )
        return pick(
            f"Which story fits x/{k} = {n}?",
            f"Share x tickets equally among {k} teams with {n} per team",
            f"Add {k} tickets to x to get {n}",
            f"Use {k} tickets from x and keep {n}",
        )
    if key == "solve-factor":
        if v == 1:
            return q(f"Solve x/{k} = {n}.", k * n)
        return q(f"Solve {k}x = {k*n if v==0 else -k*n}.", n if v == 0 else -n)
    if key == "check-value":
        candidate = n if seed % 2 else n + 1
        return pick(
            f"Does x = {candidate} satisfy {k}x = {k*n}?",
            "Yes" if candidate == n else "No",
            "Yes",
            "No",
        )
    if key == "bound-words":
        i = seed % 4
        phrases = ["at most", "at least", "less than", "more than"]
        signs = ["≤", "≥", "<", ">"]
        options = [f"x {s} {n}" for s in signs]
        return pick(
            f"Write the constraint: the load x must be {phrases[i]} {n} kg.",
            options[i],
            *options,
        )
    if key == "test-bound":
        limit = n + k + [-1, 0, 1][v]
        strict = seed % 2
        return pick(
            f"The room allows {'fewer than' if strict else 'at most'} {limit} people. May {n} players and {k} coaches enter together?",
            "Yes" if (n + k < limit if strict else n + k <= limit) else "No",
            "Yes",
            "No",
        )
    if key == "side-test":
        c = n + k + [-1, 0, 1][v]
        return pick(
            f"Can rods of lengths {k}, {c}, and {n} make a triangle?",
            "Yes" if c < n + k else "No",
            "Yes",
            "No",
        )
    if key == "side-angle":
        sides = [n, n + 2, n + 1]
        sides = sides[v:] + sides[:v]
        labels = ["C", "A", "B"]
        return pick(
            f"AB = {sides[0]}, BC = {sides[1]}, CA = {sides[2]}. Which angle faces the longest side?",
            labels[sides.index(max(sides))],
            *labels,
        )
    if key == "missing-height":
        return q(
            f"A {'triangle' if v else 'parallelogram'} of base {2*k} cm has area {(k if v else 2*k)*n} cm². Find the perpendicular height in cm.",
            n,
        )
    if key == "layer":
        return q(
            f"A prism is built in {k+1} layers. Each layer has {n} rows of {k} unit cubes. How many cubes form one layer?",
            n * k,
        )
    if key == "prism-fraction":
        return q(
            f"Find the volume in m³ of a box measuring {n}/2 m by {k} m by {k+1}/3 m.",
            F(n * k * (k + 1), 6),
        )
    if key == "prism-height":
        return q(
            f"A rectangular prism holds {n*k*(k+2)} cm³. Its base is {k} by {k+2} cm. Find its height in cm.",
            n,
        )
    if key == "axis-length":
        points = (
            f"(−{n}, {k}) and ({k+1}, {k})" if v else f"({k}, −{n}) and ({k}, {k+1})"
        )
        return q(f"Find the distance between {points}.", n + k + 1)
    if key == "fourth-vertex":
        return grid(
            f"Three corners of an axis-aligned rectangle are (−{x}, −2), (3, −2) and (3, {y}). Plot the fourth.",
            -x,
            y,
        )
    if key == "coordinate-area":
        return q(
            f"A rectangle spans x from −{k} to {n} and y from −2 to {k}. Find its area in square units.",
            (n + k) * (k + 2),
        )
    if key == "stat-question":
        contexts = [
            (
                "seedlings",
                "How tall is each seedling?",
                "How many seedlings are there?",
            ),
            (
                "runners",
                "What time did each runner finish?",
                "What is the official race distance?",
            ),
            (
                "books",
                "How many pages are in each book?",
                "How many books were selected?",
            ),
        ]
        obj, stat, fixed = contexts[v]
        return pick(
            f"A researcher selects {n} {obj}. Which question anticipates variation in the observations?",
            stat,
            fixed,
        )
    if key == "data-type":
        data = [
            "minutes spent practicing",
            "preferred school subject",
            "number of pets",
            "favorite lunch",
        ][seed % 4]
        return pick(
            f"Each of {n} students reports their {data}. What kind of variable is recorded?",
            "Numerical" if seed % 2 == 0 else "Categorical",
            "Numerical",
            "Categorical",
        )
    if key == "sample-unit":
        rows = [
            ("runners", "finish time", "One runner"),
            ("trees", "trunk diameter", "One tree"),
            ("buses", "passenger count", "One bus"),
        ]
        obj, measure, ans = rows[v]
        return pick(
            f"A study lists the {measure} of each of {n} {obj}. What does one row represent?",
            ans,
            "The entire study",
            f"The average {measure}",
        )
    if key == "stack-dots":
        ticks = [n, n + 1, n + 2]
        counts = [1 + k % 4, seed % 3, 1 + seed % 4]
        values = [tick for tick, count in zip(ticks, counts) for _ in range(count)]
        rng.shuffle(values)
        return fields(
            f"Build a dot plot for {', '.join(map(str,values))}. Set the number of dots at every tick.",
            list(map(str, ticks)), counts, [range(5)] * 3, seed, kind="dotplot",
        )
    if key == "stem-read":
        leaves = sorted([0, k % 10, (k + 3) % 10])
        return q(
            f"With tens as stems, read the {'greatest' if v else 'smallest'} value in the row with stem {n} and leaves {' '.join(map(str,leaves))}.",
            10 * n + (max(leaves) if v else min(leaves)),
        )
    if key == "stem-write":
        leaves = [sorted(rng.sample(range(10), 3)), sorted(rng.sample(range(10), 2))]
        values = [10 * (n + i) + leaf for i, row in enumerate(leaves) for leaf in row]
        rng.shuffle(values)
        display = lambda xs: " ".join(map(str, xs))
        return fields(
            f"Build the stem-and-leaf plot for {', '.join(map(str, values))}. Use the tens part as the stem.",
            [f"Stem {n}", f"Stem {n + 1}"], [display(row) for row in leaves],
            [[display(row[::-1]), display(row[:-1])] for row in leaves], seed, kind="stem-plot",
        )
    if key == "bin-edge":
        start = 10 * n
        value = start + k - 2
        groups = [f"{a}–{a+9}" for a in (start - 10, start, start + 10)]
        return pick(f"Which inclusive interval contains {value}?", groups[1], *groups)
    if key == "bin-count":
        edge = 10 * n
        values = [edge + idx for idx in range(k)] + [edge - 1, edge + 10, edge + 12]
        rng.shuffle(values)
        labels = [f"{lo}–{lo+9}" for lo in (edge - 10, edge, edge + 10)]
        return fields(
            f"Build a histogram from these data: {', '.join(map(str,values))}. Set the frequency of every bin.",
            labels, [1, k, 2], [[0, 1, 2, 3], [k - 1, k, k + 1], [0, 1, 2, 3]],
            seed, kind="histogram",
        )
    if key == "bin-total":
        return q(
            (
                "How many observations fall below 20?"
                if v
                else "How many are at least 10?"
            ),
            n + k if v else k + 3,
            visual=chart("histogram", [n, k, 3], ["0–9", "10–19", "20–29"]),
        )
    if key == "mean":
        return q(f"Find the mean of {n+k}, {n-k} and {n+3}.", n + 1)
    if key == "outlier":
        delta = 3 * k
        return q(
            f"The largest value in {n}, {n+2}, {n+4} grows to {n+4+delta}. How much does the mean rise?",
            k,
        )
    if key == "range":
        return q(f"Find the range of {n+k}, {n-2}, {n+1}, {n}.", k + 2)
    if key == "quartiles":
        values = [n, n + 1, n + 3, n + k + 4, n + k + 6, n + k + 8]
        return q(
            f"Find {'Q1' if v else 'Q3'} of {', '.join(map(str,values))} using the median of each half.",
            values[1 if v else 4],
        )
    if key == "box-summary":
        lower_middle = n + 3
        upper_middle = lower_middle + k + v
        values = [n, n + 1, lower_middle, upper_middle, upper_middle + v + 2, upper_middle + v + 4]
        median = (lower_middle + upper_middle) / 2
        five = [values[0], values[1], median, values[4], values[5]]
        return fields(
            f"Construct a box plot for {', '.join(map(str, values))}. Use the median of each half for Q1 and Q3.",
            ["Minimum", "Q1", "Median", "Q3", "Maximum"],
            [f"{x:g}" for x in five], [[f"{x - 1:g}", f"{x + 1:g}"] for x in five],
            seed, kind="boxplot",
        )
    if key == "mode":
        vals = [n, n + k, n + 1]
        vals = vals[v:] + vals[:v]
        labels = ["Art", "Sport", "Music"]
        return pick(
            "Which category is the mode?",
            labels[vals.index(max(vals))],
            *labels,
            visual=table(["Club", "Votes"], list(zip(labels, vals))),
        )
    if key == "distance-mean":
        return q(
            f"A value is {n-k if v==0 else n+k}. The mean is {n}. Find its absolute deviation.",
            k,
        )
    if key == "mad":
        return q(
            f"The mean of {n-k}, {n}, {n+k} is {n}. Find the mean absolute deviation.",
            F(2 * k, 3),
        )
    if key == "fee-total":
        return q(
            f"A bank charges ${k} a month plus ${v+1} per outside withdrawal. What is the month's total fee after {n} outside withdrawals?",
            k + n * (v + 1),
        )
    if key == "fee-compare":
        flat = k + 2 * n + [-2, 0, 2][v]
        return pick(
            f"A charges ${flat} per month. B charges ${k} plus $2 per ATM use. Which costs less after {n} uses?",
            ["A", "They cost the same", "B"][v],
            "A",
            "B",
            "They cost the same",
        )
    if key == "debit-credit":
        cases = [
            (f"A shopper pays ${n} from a bank deposit at checkout.", "Debit"),
            (f"A shopper borrows ${n} on a card and gets a bill later.", "Credit"),
            (f"A purchase of ${n} immediately lowers checking.", "Debit"),
        ]
        stem, ans = cases[v]
        return pick(
            stem + " Which type of card does this describe?", ans, "Credit", "Debit"
        )
    if key == "deposit":
        return q(
            f"Checking opens at ${10*n}. A ${2*k} deposit posts, followed by a ${n} withdrawal. Find the ending balance.",
            9 * n + 2 * k,
        )
    if key == "transfer":
        which = ["checking", "savings", "both accounts together"][v]
        return q(
            f"Checking holds ${10*n}, savings holds ${5*n}. Transfer ${k} from checking to savings. How many dollars are in {which} afterward?",
            [10 * n - k, 5 * n + k, 15 * n][v],
        )
    if key == "reconcile":
        if v == 0:
            return q(
                f"The bank shows ${10*n}. A recorded ${k} check has not yet cleared. Find the adjusted bank balance.",
                10 * n - k,
            )
        if v == 1:
            return q(
                f"The register shows ${10*n}. The bank charged an omitted ${k} fee. Find the corrected register balance.",
                10 * n - k,
            )
        return q(
            f"The statement shows ${10*n}. A recorded ${k} deposit is still in transit. Find the adjusted bank balance.",
            10 * n + k,
        )
    if key == "credit-record":
        if v == 0:
            return pick(
                f"A lender wants to know whether the payments on a ${100*n} loan were made on time. Which record should they check?",
                "Payment history",
                "Credit limit",
                "Current credit utilization",
            )
        if v == 1:
            return pick(
                f"A report shows a ${100*n} credit limit and a ${10*k} outstanding balance. Which amount is still owed?",
                f"${10*k}",
                f"${100*n}",
                f"${100*n-10*k}",
            )
        return pick(
            f"A borrower has made {n} on-time payments. Which additional event belongs in the account payment history?",
            "A missed scheduled payment",
            "A change of favorite bank branch",
            "A grocery purchase paid in cash",
        )
    if key == "credit-error":
        if v == 0:
            return pick(
                f"A report lists an unfamiliar ${100*n} account. What should the borrower do?",
                "Check records and dispute inaccurate information",
                "Assume the entry is accurate",
                "Discard the account documents",
            )
        if v == 1:
            return pick(
                f"A payment appears {n} days late, but the borrower paid on time. Which evidence best supports a dispute?",
                "A dated payment confirmation",
                "A copy of an unrelated loan offer",
                "A list of planned purchases",
            )
        return q(
            f"A report counts the same ${10*n} debt twice. If the duplicate is corrected, by how many dollars should the reported total fall?",
            10 * n,
        )
    if key == "credit-use":
        ontime = "Borrower A" if seed % 2 else "Borrower B"
        other = "Borrower B" if seed % 2 else "Borrower A"
        return pick(
            f"{ontime} made all {n} payments on time. {other} missed {k if k<=n else 1} of {n}. Which repayment history suggests lower risk?",
            ontime,
            "Borrower A",
            "Borrower B",
        )
    if key == "aid-kind":
        cases = [
            (
                f"A student earns ${n*50} in an eligible campus work-study job.",
                "Earned wages",
            ),
            (f"A school awards a ${n*100} scholarship.", "Gift aid"),
            (f"A student takes out a ${n*200} education loan.", "Borrowed funds"),
        ]
        stem, ans = cases[v]
        return pick(
            stem + " How should this funding be classified?",
            ans,
            "Earned wages",
            "Gift aid",
            "Borrowed funds",
        )
    if key == "aid-gap":
        return q(
            f"Tuition costs ${500*n+100*k}. A grant covers ${200*n} and savings cover ${50*k}. Find the remaining cost.",
            300 * n + 50 * k,
        )
    if key == "loan-share":
        return q(
            f"College costs ${300*n+50*k}. A grant covers ${200*n} and savings pay ${50*k}. The rest is borrowed. How much principal must be repaid?",
            100 * n,
        )
    if key == "annual-gap":
        return q(
            f"Two jobs pay ${n+k} and ${n} per hour for {1200+50*n} hours yearly. What is their annual earnings difference?",
            k * (1200 + 50 * n),
        )
    if key == "lifetime":
        return q(
            f"Two jobs pay ${30000+1000*n} and $30000 annually for {20+k} years. At constant pay, what is the lifetime difference?",
            1000 * n * (20 + k),
        )
    if key == "break-even":
        return q(
            f"Training costs ${n*k*100} and raises annual earnings by ${k*100}. Assuming constant pay, how many years recover the expense?",
            n,
        )
    raise ValueError(key)
