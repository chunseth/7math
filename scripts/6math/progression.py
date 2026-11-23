"""Content and prerequisites for the expanded Grade 6 course."""

from pathlib import Path
from course_progression import expand_course
from focused import problem

BASE = Path(__file__).parent
# Foundation strands can be taken in parallel. Each feeds the first core skill that uses it.
FOUNDATIONS = {
    "foundation-sums": ("Addition facts and place value", []),
    "foundation-differences": ("Subtraction facts and regrouping", []),
    "foundation-products": ("Multiplication fact families", []),
    "foundation-division": ("Division fact families", []),
    "foundation-whole": (
        "Whole-number operations",
        ["foundation-products", "foundation-division"],
    ),
    "foundation-fractions": (
        "Fraction equivalence and arithmetic",
        ["foundation-products"],
    ),
}
BRIDGES = {
    "quotients": ["foundation-fractions", "foundation-division"],
    "add": ["foundation-sums", "foundation-differences"],
    "factors": ["foundation-products"],
    "fluency": ["foundation-whole"],
}


def expand(lessons, clips, bank):
    examples = dict(
        line.split("|", 1)
        for line in (BASE / "examples.txt").read_text().splitlines()
        if line and not line.startswith("#")
    )

    def worked_example(key):
        prompt, a, x, b, y, answer = examples.pop(key).split("|")
        return dict(
            model="worked",
            prompt=prompt,
            steps=[dict(label=a, math=x), dict(label=b, math=y)],
            result=answer,
            answer=answer,
            color="#246650",
        )

    result = expand_course(
        lessons, clips, bank, 6, BASE, FOUNDATIONS, BRIDGES, problem, worked_example
    )
    assert not examples
    return result
