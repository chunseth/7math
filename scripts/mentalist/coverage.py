"""Evidence links use original catalog IDs and the order of requiredVariants.
A dash is an explicit outstanding requirement. A number is a level ordinal.
For groups, a selector names the operation-specific child and level.
"""

EVIDENCE = {
    "review.add": "1 1 2 3 3 -",
    "review.subtract": "1 2 3 3 -",
    "review.multiply": "*",
    "review.divide": "* * *",
    "review.whole": "1 2 3 4 -",
    "review.factors": "1 2 1 2",
    "review.fractions": "1 2 3 4",
    "review.conversions": "1 - 2 3 4 4",
    "review.numberline": "1 1 2 -",
    "review.expressions": "1 2 3 4 -",
    "review.coordinate": "1 1 2 -",
    "review.area": "1 - 2 3 4 2 1",
    "review.angles": "1 1 2 3",
    "review.data": "1 1 - 2 2 - - 3 4",
    "review.onestep": "1 1 2 2 3",
    "number.sets": "- 1 2 2",
    "number.integer-add": "signed.add.1 signed.add.2 signed.subtract.2 -",
    "number.integer-multiply": "signed.multiply.1 signed.multiply.1 signed.divide.1",
    "number.decimal": "* *",
    "number.fraction": "* fraction.add.2 fraction.add.3 fraction.add.4",
    "number.mixed": "2 1 1 3",
    "number.context": "3 2 1 3 -",
    "ratio.equivalent": "- 1 2 3 2",
    "ratio.unit": "2 1 3 1",
    "ratio.constant": "1 2 3 3 1",
    "ratio.represent": "- 2 1 1 3 4 4 -",
    "ratio.travel": "1 2 3 1",
    "ratio.solve": "1 2 3 -",
    "ratio.units": "1 1 2 2 -",
    "percent.parts": "1 2 3 1",
    "percent.change": "1 1 2 3 1",
    "percent.multistep": "1 2 3 -",
    "similar.attributes": "1 - 2 3",
    "similar.lengths": "2 1 2 3",
    "similar.drawings": "1 2 3 3 3",
    "chance.space": "2 - 3 2",
    "chance.theoretical": "2 1 1 3",
    "chance.complement": "1 2 2",
    "chance.experimental": "1 1 1 3",
    "chance.simulate": "1 - 2 1 2 2",
    "chance.compare": "1 1 - 2",
    "stats.graphs": "1 1 2 3 3 3 1",
    "stats.groups": "3 1 2 3 - -",
    "stats.sample": "1 1 1 2 2",
    "stats.populations": "2 2 - 2",
    "linear.read": "1 - 3 1 2 1 -",
    "linear.represent": "- 1 2 3 4 -",
    "algebra.check": "1 - 2",
    "algebra.equation": "1 3 2 4",
    "algebra.inequality": "2 3 3 4",
    "algebra.write": "1 2 1 3",
    "algebra.story": "1 - -",
    "algebra.graph": "1 2 2 - 3",
    "geometry.angles": "2 1 1 2 3 3",
    "circle.pi": "1 1 - 1 2 -",
    "circle.measure": "2 1 3 1",
    "area.composite": "5 1 3 - 3 2 4 - 5 -",
    "solid.prism": "2 1 1 3",
    "solid.models": "1 1 2 1 - 2",
    "solid.pyramid": "2 1 -",
    "solid.nets": "1 2 3 4 1 -",
    "solid.surface": "* 1 1 1 -",
    "finance.tax": "1 1 2 2",
    "finance.budget": "2 - 2 1 - 1 2 3",
    "finance.networth": "1 2 2 2",
    "finance.household": "1 1 2 2 1",
    "finance.simple": "1 1 1 2 1",
    "finance.compound": "1 1 3 2",
    "finance.deals": "1 2 3 3 3 -",
}
ADDED = {
    "review.add": [1],
    "review.subtract": [1],
    "review.whole": [1],
    "review.conversions": [1],
    "review.numberline": [3],
    "review.expressions": [3],
    "review.coordinate": [2],
    "review.area": [1],
    "review.data": [2, 3, 3],
    "number.sets": [2],
    "number.integer-add": ["signed.add.3"],
    "number.context": [3],
    "ratio.equivalent": [1],
    "ratio.represent": [1, 4],
    "ratio.solve": [3],
    "ratio.units": [1],
    "percent.multistep": [1],
    "similar.attributes": [1],
    "chance.space": [2],
    "chance.simulate": [1],
    "chance.compare": [2],
    "stats.groups": [3, 2],
    "stats.populations": [2],
    "linear.read": [1, 2],
    "linear.represent": [4, 4],
    "algebra.check": [1],
    "algebra.graph": [3],
    "circle.pi": [1, 2],
    "area.composite": [2, 4, 5],
    "solid.pyramid": [3],
    "solid.nets": [3],
    "solid.surface": [1],
    "finance.budget": [2, 2],
    "finance.deals": [3],
}


def matrix(nodes, levels, skills):
    result = []
    for n in nodes:
        group = n["id"]
        selectors = EVIDENCE[group].split()
        if group in ADDED:
            added = iter(ADDED[group])
            selectors = [str(next(added)) if v == "-" else v for v in selectors]
            assert next(added, None) is None
        assert len(selectors) == len(n["requiredVariants"]), (
            group,
            selectors,
            n["requiredVariants"],
        )
        children = {s["id"] for s in skills if s["group"] == group}
        for name, selector in zip(n["requiredVariants"], selectors):
            ids = [
                l["id"]
                for l in levels
                if l["skill"] in children
                and (
                    selector == "*"
                    or selector == str(l["ordinal"])
                    or selector == l["id"]
                )
            ]
            assert ids or selector == "-", (group, selector)
            result.append(
                dict(
                    group=group,
                    requirement=name,
                    levels=ids,
                    status="mapped" if ids else "outstanding",
                )
            )
    return result
