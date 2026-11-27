"""Compile level question pools and round blueprints offline. Rebuild with python3 -B scripts/mentalist/build.py."""

import gzip, hashlib, json, random, sys
from fractions import Fraction
from pathlib import Path
from arithmetic import arithmetic, fact, review
from topics import topic
from formats import verify_expression
from coverage import matrix
from variants import extension

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "content/mentalist"
skills = json.loads((OUT / "skills.json").read_text())
catalog = json.loads((ROOT / "docs/curriculum/skill-tree.json").read_text())
levels = []
questions = {}
sets = []
templates = {}


def target(s, q):
    fmt = q["control"]["kind"]
    if fmt == "story":
        return 90
    if fmt not in ("whole", "decimal", "fraction", "choice"):
        return 60
    if s.startswith(("review.multiply.", "review.divide.")):
        return 5
    if q.get("visual", {}).get("kind") == "signed-groups":
        return 30
    if s.startswith("signed."):
        return 10
    if s.startswith("decimal."):
        return 20
    if fmt == "choice":
        return 20
    if s.endswith(("multistep", "context", "compound", "composite")):
        return 45
    return 30


def audit(q):
    verify_expression(q)
    c = q["control"]
    ans = q["answer"]
    kind = c["kind"]
    if kind in ("whole", "decimal", "fraction"):
        f = Fraction(ans)
        if kind != "fraction":
            assert len(ans.lstrip("-").split(".")[0]) == c["width"]
        if kind == "whole":
            assert f.denominator == 1
    elif kind == "choice":
        assert ans in c["options"] and len(set(c["options"])) == len(c["options"])
    elif kind in ("graph", "drawing", "line"):
        for pair in ans.split(";"):
            assert all(
                abs(Fraction(v)) <= c["limit"] * c.get("step", 1)
                for v in pair.split(",")
            )
    else:
        vals = ans.split("|")
        assert len(vals) == len(c["fields"])
        assert all(val in field["options"] for val, field in zip(vals, c["fields"]))


def variants(s, l):
    if s == "signed.add":
        return [
            ["both-positive", "both-negative"],
            ["positive-plus-negative", "negative-plus-positive"],
            ["positive-plus-negative", "negative-plus-positive", "zero-addend"],
        ][l - 1]
    if s in ("signed.multiply", "signed.divide") and l == 1:
        return [
            "positive-positive",
            "negative-positive",
            "positive-negative",
            "negative-negative",
            "zero",
        ]
    return ["form-a", "form-b", "form-c"]


for skill in skills:
    s = skill["id"]
    for l, title in enumerate(skill["levels"], 1):
        lid = f"{s}.{l}"
        levelsets = []
        configs = []
        pool = []
        used = set()
        tables = skill.get("tables", [])
        tags = variants(s, l)
        rng = random.Random(lid)
        operands = {}
        for table in tables:
            # Keep 0 ÷ 1 in the zero-dividend family and avoid division by zero.
            values = range(1, 13) if skill["group"] == "review.divide" and table in (0, 1) else range(13)
            operands[table] = rng.sample(list(values), len(values))
        for index in range(24):
            slot = index % 12
            v = tables[slot % len(tables)] if tables else slot % len(tags)
            n = rng.randrange(1, 80)
            for _ in range(512):
                extra = None if tables else extension(s, l, n, v)
                if tables:
                    n = operands[v].pop()
                    row = fact(skill["group"], v, n, reverse=(slot + index // 12) % 2 == 1)
                    tag = f"table-{v}"
                    module = "arithmetic"
                elif extra:
                    tag, row = extra
                    module = "variants"
                elif s.startswith(("signed.", "fraction.", "decimal.")):
                    row = arithmetic(s, l, n, v)
                    tag, module = tags[v], "arithmetic"
                elif s.startswith("review."):
                    row = review(s, l, n, v)
                    tag, module = tags[v], "arithmetic"
                else:
                    row = topic(s, l, n, v)
                    tag, module = tags[v], "topics"
                surface = json.dumps([row["prompt"], row.get("visual"),
                    [f["label"] for f in row["control"].get("fields", [])]], sort_keys=True)
                if surface not in used:
                    break
                n += 1
            else:
                raise ValueError((lid, index, "duplicate scenario"))
            audit(row)
            used.add(surface)
            key = json.dumps([row["prompt"], row.get("visual"), row["control"]], sort_keys=True)
            ident = row.pop("id", s + "." + hashlib.sha256(key.encode()).hexdigest()[:16])
            if ident in questions:
                assert questions[ident] == row, (lid, ident)
            questions[ident] = row
            variant = f"{lid}.{tag}"
            templates[variant] = dict(
                id=variant, level=lid, focus=title, variant=tag,
                authoringModule=module,
                parameterNames=["configuration", "variantIndex"], response=row["control"]["kind"],
                scoring="exact-rational-or-structured-v1",
            )
            pool.append(dict(q=ident, variant=variant, parameters=[n, v], target=target(s, row)))
        # Keep the published 12-slot blueprints available to set-based consumers.
        first, second = pool[:12], pool[12:]
        blueprints = [first, second]
        while len(blueprints) < 5:
            positions = [rng.choice(pair) for pair in zip(first, second)]
            if positions not in blueprints:
                blueprints.append(positions)
        for bank, positions in enumerate(blueprints):
            sid = f"v4.{lid}.set{bank+1}"
            levelsets.append(sid)
            assert len({p["q"] for p in positions}) == 12
            sets.append(dict(id=sid, level=lid, positions=positions))
            configs.append([p["variant"] for p in positions])
        assert all(c == configs[0] for c in configs)
        assert (
            len({tuple(p["target"] for p in st["positions"]) for st in sets[-5:]}) == 1
        ), lid
        assert (
            len({tuple(p["q"] for p in st["positions"]) for st in sets[-5:]}) == 5
        ), lid
        example = questions[sets[-1]["positions"][0]["q"]]
        levels.append(
            dict(
                id=lid,
                skill=s,
                title=title,
                ordinal=l,
                sets=levelsets,
                pool=pool,
                slots=configs[0],
                preview={k: v for k, v in example.items() if k in ("prompt", "visual")},
                target=sum(p["target"] for p in sets[-1]["positions"]),
            )
        )
assert (
    len(skills),
    len(levels),
    len(sets),
    sum(len(s["positions"]) for s in sets),
) == (87, 237, 1185, 14220)
coverage = matrix(catalog["nodes"], levels, skills)
bank = dict(
    coverage=coverage,
    version=7,
    templates=list(templates.values()),
    skills=skills,
    levels=levels,
    questions=questions,
    sets=sets,
)
data = json.dumps(bank, ensure_ascii=False, separators=(",", ":")).encode()
preview = [
    {
        k: v
        for k, v in level.items()
        if k in ("id", "title", "skill", "ordinal", "preview")
    }
    for level in levels
]
files = {
    OUT
    / "coverage.json": (
        json.dumps(coverage, ensure_ascii=False, indent=1) + "\n"
    ).encode(),
    OUT / "bank-v7.json.gz": gzip.compress(data, mtime=0),
    OUT
    / "trail.json": (json.dumps(preview, ensure_ascii=False, indent=1) + "\n").encode(),
}
for p, data in files.items():
    if "--check" in sys.argv:
        existing = p.read_bytes()
        assert (
            gzip.decompress(existing) == gzip.decompress(data)
            if p.suffix == ".gz"
            else existing == data
        ), f"Stale {p.name}"
    else:
        p.write_bytes(data)
print(
    f"Validated {len(skills)} skills, {len(levels)} levels, {len(sets)} sets, {12 * len(sets):,} positions, {len(questions)} distinct questions."
)
