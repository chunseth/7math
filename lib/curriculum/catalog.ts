import catalog from "../../docs/curriculum/skill-tree.json";

export type Concept = (typeof catalog.nodes)[number];
export const concepts: readonly Concept[] = catalog.nodes;
export const branchTitles: Record<string, string> = {
  review: "Foundational review", number: "Rational numbers", ratio: "Ratios and rates",
  percent: "Percents", similar: "Similarity and scale", chance: "Probability",
  stats: "Statistics", linear: "Linear relationships", algebra: "Equations and inequalities",
  geometry: "Angle relationships", circle: "Circles", area: "Composite area",
  solid: "Solids", finance: "Financial literacy",
};
export const branches = catalog.branches.map((branch) => ({ ...branch, title: branchTitles[branch.id] }));
export const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
export const CATALOG_VERSION = `${catalog.catalogId}:v${catalog.schemaVersion}`;

export function validateCatalog() {
  if (conceptById.size !== concepts.length) throw new Error("Duplicate concept ID");
  const active = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string) {
    if (active.has(id)) throw new Error(`Dependency cycle at ${id}`);
    if (visited.has(id)) return;
    const concept = conceptById.get(id);
    if (!concept) throw new Error(`Unknown prerequisite ${id}`);
    active.add(id);
    concept.prerequisites.forEach(visit);
    active.delete(id);
    visited.add(id);
  }
  concepts.forEach((concept) => visit(concept.id));
}
validateCatalog();
