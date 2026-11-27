"""Authoring helpers. Only final prompts and controls are presented to players."""

from fractions import Fraction as F


def q(prompt, answer, kind=None, *, signed=False, visual=None, places=None):
    value = F(answer)
    if kind is None:
        kind = "whole" if value.denominator == 1 else "fraction"
    if kind == "decimal":
        places = (
            places
            if places is not None
            else len(f"{float(value):.6f}".rstrip("0").partition(".")[2])
        )
        raw = f"{float(value):.{places}f}"
        assert F(raw) == value
    else:
        raw = str(value)
    control = dict(kind=kind, signed=signed or value < 0)
    if kind != "fraction":
        control.update(width=len(raw.lstrip("-").split(".")[0]), places=places or 0)
    return item(prompt, raw, control, visual)


def item(prompt, answer, control, visual=None):
    row = dict(prompt=prompt, answer=str(answer), control=control)
    if visual:
        row["visual"] = visual
    return row


def choose(prompt, correct, others, order, visual=None):
    opts = list(dict.fromkeys(map(str, [correct, *others])))
    assert len(opts) >= 2
    k = order % len(opts)
    return item(
        prompt, correct, dict(kind="choice", options=opts[k:] + opts[:k]), visual
    )


def fields(prompt, labels, values, choices, order, visual=None, kind="table"):
    if kind == "net" and prompt.endswith("The labeled numbers are face areas."):
        prompt = prompt.replace("The labeled numbers are face areas.", "The labeled face areas are in cm².")
    opts = []
    for i, (label, val, options) in enumerate(zip(labels, values, choices)):
        opts.append(
            dict(
                label=label,
                options=choose("", val, options, order + i)["control"]["options"],
            )
        )
    return item(
        prompt, "|".join(map(str, values)), dict(kind=kind, fields=opts), visual
    )


def tenth_line(prompt, tick):
    center = 10 * (tick // 10) + 5
    return item(prompt, f"{tick / 10:g},0", dict(kind="line", limit=5, step=0.1, origin=center / 10))


def scatter_task(points):
    rows = [(str(x), str(y)) for x, y in points]
    return item(
        "Construct the scatterplot. Plot all three observations from the table.",
        ";".join(sorted(f"{x},{y}" for x, y in rows)),
        dict(kind="scatterplot", limit=10, points=len(rows)),
        table(["x", "y"], rows),
    )


def grid(prompt, x, y, limit=10, kind="graph", visual=None):
    return item(prompt, f"{x},{y}", dict(kind=kind, limit=limit), visual)


def chart(kind, values, labels=None):
    return dict(
        kind=kind,
        values=values,
        labels=labels or [str(i + 1) for i in range(len(values))],
    )


def table(headers, rows):
    return dict(
        kind="data", headers=headers, rows=[[str(x) for x in row] for row in rows]
    )


def mixed(f):
    f = F(f)
    if f <= 1 or f.denominator == 1:
        return str(f)
    return f"{f.numerator//f.denominator} {f.numerator%f.denominator}/{f.denominator}"


def verify_expression(question):
    """Independently recompute literal arithmetic, including mixed-number operands."""
    import re
    from operator import add, sub, mul, truediv

    if question["control"]["kind"] not in ("whole", "decimal", "fraction"):
        return
    atom = r"[−-]?(?:\d+ \d+/\d+|\d+/\d+|\d+(?:\.\d+)?)"
    match = re.fullmatch(f"({atom}) (×|÷|−|\\+) \\(?({atom})\\)?", question["prompt"])
    if not match:
        return

    def exact(text):
        text = text.replace("−", "-")
        if " " not in text:
            return F(text)
        whole, frac = text.split()
        return F(whole) + (1 if not whole.startswith("-") else -1) * F(frac)

    left, op, right = match.groups()
    correct = {"+": add, "−": sub, "×": mul, "÷": truediv}[op](
        exact(left), exact(right)
    )
    assert F(question["answer"]) == correct, question
