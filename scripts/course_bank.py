"""Build a middle-school lesson map, short worked examples and publishable practice bank."""

from collections import Counter
import hashlib
from fractions import Fraction
import gzip
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts/mentalist"))


def generate(grade, source, problem, expand=None):
    course = f"{grade}math"
    out = ROOT / "content" / course
    prefix = f"g{grade}."
    lessons, clips, levels, questions, sets, skills = [], [], [], {}, [], []
    seen = set()
    for line in source.with_name("lessons.txt").read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        if line.startswith("["):
            unit = line[1:-1]
            continue
        slug, title, codes, deps, prompt, a, x, b, y, answer = line.split("|")
        parents = deps.split(",") if deps else []
        assert slug not in seen and set(parents) <= seen, slug
        seen.add(slug)
        skill = prefix + slug
        level = skill + ".1"
        prerequisites = [prefix + p for p in parents]
        lessons.append(
            dict(
                id=skill,
                title=title,
                example=prompt,
                unit=unit,
                standards=[f"{grade}." + c for c in codes.split(",")],
                prerequisites=prerequisites,
            )
        )
        skills.append(
            dict(
                id=skill,
                title=title,
                group=skill,
                prerequisites=prerequisites,
                levels=[title],
            )
        )
        clips.append(
            dict(
                skill=skill,
                level=level,
                model="worked",
                prompt=prompt,
                steps=[dict(label=a, math=x), dict(label=b, math=y)],
                result=answer,
                answer=answer,
                subprompt="",
                color="#246650",
            )
        )
        pool, surfaces = [], set()
        for seed in range(24):
            row = problem(slug, seed)
            surface = json.dumps([row["prompt"], row.get("visual")], sort_keys=True)
            assert surface not in surfaces, (slug, seed, surface)
            surfaces.add(surface)
            ident = f"{skill}.q{seed+1}"
            questions[ident] = row
            evidence = None
            if slug == "scatter" and row["control"]["kind"] == "scatterplot":
                evidence = "construct a scatterplot"
            elif slug == "sampling" and row.get("visual", {}).get("kind") == "simulation":
                evidence = "interpret a simulated sample"
            elif slug == "inequalities" and row["control"]["kind"] == "ray":
                evidence = "graph an inequality"
            elif slug == "estimate" and row["control"]["kind"] == "line":
                evidence = "mark an irrational approximation"
            pool.append(
                dict(
                    q=ident,
                    variant=f"{skill}.form{seed%3}",
                    parameters=[seed],
                    target=45,
                    **({"evidence": evidence} if evidence else {}),
                )
            )
        rng = random.Random(skill)
        fixed = [pool[:12], pool[12:]]
        while len(fixed) < 5:
            sample = [rng.choice(pair) for pair in zip(pool[:12], pool[12:])]
            if sample not in fixed:
                fixed.append(sample)
        for i, positions in enumerate(fixed, 1):
            sets.append(dict(id=f"{level}.set{i}", level=level, positions=positions))
        levels.append(
            dict(
                id=level,
                skill=skill,
                title=title,
                ordinal=1,
                pool=pool,
                preview=dict(prompt=prompt),
            )
        )
    bank = dict(
        version=grade * 1000 + 1,
        skills=skills,
        levels=levels,
        questions=questions,
        sets=sets,
        templates=[],
        coverage=[],
    )
    if expand:
        lessons, clips, bank = expand(lessons, clips, bank)
        levels, questions = bank["levels"], bank["questions"]
    artifacts = {
        out / "lessons.json": lessons,
        out / "previews.json": clips,
        out / "bank.json.gz": bank,
    }
    for level in levels:
        ident = level["id"]
        mix = [f'{slot["variant"]}:{slot["target"]}' for slot in level["pool"]]
        assert Counter(mix[:12]) == Counter(mix[12:]), ident
        public = []
        for i, slot in enumerate(level["pool"]):
            row = questions[slot["q"]]
            answer = row["answer"]
            if row["control"]["kind"] in ("whole", "decimal", "fraction"):
                answer = str(Fraction(answer))
            key = json.dumps(
                [ident, i, answer], ensure_ascii=False, separators=(",", ":")
            ).encode()
            public.append(
                {k: v for k, v in row.items() if k != "answer"}
                | {"check": hashlib.sha256(key).hexdigest()}
            )
        artifacts[ROOT / "public" / course / "practice" / (ident + ".json")] = dict(
            level=ident, set=ident, questions=public, mix=mix
        )
    return artifacts


def build(grade, source, problem, expand=None):
    for path, value in generate(grade, Path(source), problem, expand).items():
        name = path.name
        data = (
            json.dumps(
                value,
                ensure_ascii=False,
                indent=(
                    1
                    if path.parent.parent == ROOT / "content" and path.suffix == ".json"
                    else None
                ),
            )
            + "\n"
        ).encode()
        if "--check" in sys.argv:
            actual = path.read_bytes()
            assert (
                gzip.decompress(actual) if name.endswith(".gz") else actual
            ) == data, name
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(
                gzip.compress(data, mtime=0) if name.endswith(".gz") else data
            )
