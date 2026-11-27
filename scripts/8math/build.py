"""Build the Grade 8 lesson map, examples and question bank."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from course_bank import build
from problems import problem
from progression import expand

if __name__ == "__main__":
    build(8, __file__, problem, expand)
