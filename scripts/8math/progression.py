"""Prerequisite bridges from Grade 7 skills into Grade 8 topics."""

from pathlib import Path
from course_progression import expand_course
from focused import problem, worked_example

FOUNDATIONS = {
    "foundation-numbers": ("Signed numbers and fractions", []),
    "foundation-ratios": ("Rates, ratios and percents", []),
    "foundation-algebra": ("Expressions and one-step equations", []),
    "foundation-plane": ("Coordinates, angles and measurement", []),
    "foundation-data": ("Data summaries and samples", []),
}
BRIDGES = {
    "repeat": ["foundation-numbers"],
    "similar": ["foundation-ratios"],
    "translate": ["foundation-plane"],
    "model": ["foundation-algebra"],
    "mad": ["foundation-data"],
}


def expand(lessons, clips, bank):
    return expand_course(
        lessons,
        clips,
        bank,
        8,
        Path(__file__).parent,
        FOUNDATIONS,
        BRIDGES,
        problem,
        worked_example,
    )
