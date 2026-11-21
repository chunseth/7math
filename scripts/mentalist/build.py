"""Compile fixed sets offline. Rebuild with python3 -B scripts/mentalist/build.py."""

import gzip, hashlib, json, sys
from fractions import Fraction
from pathlib import Path
from arithmetic import arithmetic, review
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
    if s.startswith(("review.multiply.", "review.divide.")):
        return ["zero", "identity", "small-facts", "larger-facts"]
    return ["form-a", "form-b", "form-c"]


for skill in skills:
    s = skill["id"]
    for l, title in enumerate(skill["levels"], 1):
        lid = f"{s}.{l}"
        levelsets = []
        configs = []
        for bank in range(5):
            positions = []
            used = set()
            for slot in range(12):
                tags = variants(s, l)
                v = slot % len(tags)
                n = (
                    (slot + bank * 3) % 13
                    if s.startswith(("review.multiply.", "review.divide."))
                    else slot + bank * 7 + 1
                )
                if s.startswith(("review.multiply.", "review.divide.")):
                    # One zero, one identity, five small and five larger facts.
                    fixed = (
                        [0, 1]
                        + [2 + (i + bank) % 5 for i in range(5)]
                        + [7 + (i + bank) % 6 for i in range(5)]
                    )
                    n = fixed[slot]
                    v = 0 if n == 0 else 1 if n == 1 else 2 if n <= 6 else 3
                for attempt in range(256):
                    extra = extension(s, l, n, v)
                    if extra:
                        tag, row = extra
                    elif s.startswith(("signed.", "fraction.", "decimal.")):
                        row = arithmetic(s, l, n, v)
                    elif s.startswith("review."):
                        row = review(s, l, n, v)
                    else:
                        row = topic(s, l, n, v)
                    key = json.dumps(
                        [row["prompt"], row.get("visual"), row["control"]],
                        sort_keys=True,
                    )
                    surface = json.dumps(
                        [
                            row["prompt"],
                            row.get("visual"),
                            [f["label"] for f in row["control"].get("fields", [])],
                        ],
                        sort_keys=True,
                    )
                    if surface not in used:
                        break
                    n += 1
                else:
                    raise ValueError((lid, bank, slot, "duplicate scenario"))
                audit(row)
                used.add(surface)
                ident = row.pop(
                    "id", s + "." + hashlib.sha256(key.encode()).hexdigest()[:16]
                )
                if ident in questions:
                    assert questions[ident] == row, (lid, ident)
                questions[ident] = row
                tag = extra[0] if extra else tags[v]
                variant = f"{lid}.{tag}"
                templates[variant] = dict(
                    id=variant,
                    level=lid,
                    focus=title,
                    variant=tag,
                    authoringModule=(
                        "variants"
                        if extra
                        else (
                            "arithmetic"
                            if s.startswith(
                                ("review.", "signed.", "decimal.", "fraction.")
                            )
                            else "topics"
                        )
                    ),
                    parameterNames=["configuration", "variantIndex"],
                    response=row["control"]["kind"],
                    scoring="exact-rational-or-structured-v1",
                )
                positions.append(
                    dict(
                        q=ident,
                        variant=variant,
                        parameters=[n, v],
                        target=target(s, row),
                    )
                )
            sid = f"{lid}.set{bank+1}"
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
) == (100, 250, 1250, 15000)
coverage = matrix(catalog["nodes"], levels, skills)
bank = dict(
    coverage=coverage,
    version=1,
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
    OUT / "bank-v1.json.gz": gzip.compress(data, mtime=0),
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
    f"Validated {len(skills)} skills, {len(levels)} levels, {len(sets)} sets, 15,000 positions, {len(questions)} distinct questions."
)
