"""Assemble ordered skill progressions, retaining the previous mixed-level IDs."""

import gzip
import json
from random import Random
from course_bank import ROOT


def read_sequences(base):
    groups = {}
    for line in (base / "progression.txt").read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        if line.startswith("["):
            name = line[1:-1]
            assert name not in groups, name
            groups[name] = []
        else:
            source, title = line.split("|")
            groups[name].append((source, title))
    return groups


def expand_course(
    lessons, clips, bank, grade, base, foundations, bridges, problem, worked_example
):
    prefix = f"g{grade}."
    originals = {s["id"]: s for s in bank["skills"]}
    original_levels = {l["skill"]: l for l in bank["levels"]}
    original_clips = {c["skill"]: c for c in clips}
    topics = {s["id"][3:]: s for s in lessons}
    source = ROOT / "content/mentalist"
    shared = json.loads(gzip.decompress((source / "bank-v7.json.gz").read_bytes()))
    shared_levels = {l["id"]: l for l in shared["levels"]}
    # Grade 6 intentionally retains one-step practice while Grade 7 advances
    # to two-step number-line tasks under the same Grade 7 level IDs.
    one_step = {"algebra.graph.1", "algebra.graph.2", "algebra.graph.3"} if grade == 6 else set()
    prior = json.loads(gzip.decompress((source / "bank-v3.json.gz").read_bytes())) if one_step else None
    if prior:
        shared_levels.update({level["id"]: level for level in prior["levels"] if level["id"] in one_step})
    shared_clips = {
        c["level"]: c for c in json.loads((source / "previews.json").read_text())
    }
    sequences = read_sequences(base)
    assert list(sequences) == [*foundations, *topics]
    used = set()
    catalog, videos, skills, levels = [], [], [], []
    for topic, stages in sequences.items():
        foundation = topic in foundations
        if foundation:
            title, parents = foundations[topic]
            unit, codes = "Foundational review", []
            parents = [prefix + p for p in parents]
        else:
            old = topics[topic]
            title, unit, codes = old["title"], old["unit"], old["standards"]
            parents = old["prerequisites"] + [
                prefix + p for p in bridges.get(topic, [])
            ]
        skill = prefix + (topic if foundation else "steps-" + topic)
        previews = []
        for ordinal, (key, label) in enumerate(stages, 1):
            assert key not in used, key
            used.add(key)
            level = f"{skill}.{ordinal}"
            if key in shared_levels:
                ref = shared_clips[key]
                clip = dict(
                    ref,
                    mediaCourse="mentalist",
                    media=ref.get(
                        "media", key if ref["model"] == "worked" else ref["skill"]
                    ),
                )
                slots = shared_levels[key]["pool"]
                bank_source = prior if key in one_step else shared
                questions = [bank_source["questions"][slot["q"]] for slot in slots]
                if key in one_step:
                    clip.pop("mediaCourse")
                    clip.pop("media")
                    clip.update(worked_example(key))
                if key == "linear.represent.1":
                    # The source varies its x-values in the table controls.
                    questions = [
                        dict(row, prompt=row["prompt"] + " Use " + " and ".join(
                            field["label"] for field in row["control"]["fields"]
                        ) + ".") for row in questions
                    ]
            else:
                clip = worked_example(key)
                questions = [problem(key, seed) for seed in range(24)]
            previews.append(dict(title=label, example=clip["prompt"]))
            videos.append(dict(clip, skill=skill, level=level))
            assert (
                len(questions) == 24
                and len({json.dumps([q["prompt"], q.get("visual")], sort_keys=True) for q in questions}) == 24
            ), key
            pool = []
            for i, row in enumerate(questions):
                qid = f"{level}.q{i+1}"
                bank["questions"][qid] = row
                variant = slots[i]["variant"] if key in shared_levels else f"form{i%3}"
                target = slots[i]["target"] if key in shared_levels else 45
                pool.append(dict(q=qid, variant=variant, target=target, parameters=[i]))
            levels.append(
                dict(
                    id=level,
                    skill=skill,
                    title=label,
                    ordinal=ordinal,
                    pool=pool,
                    preview=dict(prompt=clip["prompt"]),
                )
            )
            # Preserve the reviewed mix of variants and timing targets for reused levels.
            if key in shared_levels:
                mapping = {slot["q"]: p for slot, p in zip(slots, pool)}
                sets = [
                    [mapping[p["q"]] for p in s["positions"]]
                    for s in bank_source["sets"]
                    if s["level"] == key
                ]
            else:
                rng = Random(level)
                sets = [pool[:12], pool[12:]]
                while len(sets) < 5:
                    sample = [rng.choice(pair) for pair in zip(pool[:12], pool[12:])]
                    if sample not in sets:
                        sets.append(sample)
            assert len(sets) == 5 and all(len(s) == 12 for s in sets), key
            bank["sets"].extend(
                dict(id=f"{level}.set{i}", level=level, positions=s)
                for i, s in enumerate(sets, 1)
            )
        catalog.append(
            dict(
                id=skill,
                title=title,
                unit=unit,
                example=previews[0]["example"],
                standards=codes,
                prerequisites=parents,
                stages=previews,
            )
        )
        skills.append(
            dict(
                id=skill,
                title=title,
                group=skill,
                levels=[s["title"] for s in previews],
                prerequisites=parents,
            )
        )
        if not foundation:
            # The previous levels retain their complete pools, clips, IDs and scores.
            mixed = old["id"]
            catalog.append(
                dict(
                    old,
                    prerequisites=[skill],
                    previousPrerequisites=old["prerequisites"],
                )
            )
            skills.append(dict(originals[mixed], prerequisites=[skill]))
            levels.append(original_levels[mixed])
            videos.append(original_clips[mixed])
    bank.update(version=6007 if grade == 6 else 8006, skills=skills, levels=levels)
    return catalog, videos, bank
