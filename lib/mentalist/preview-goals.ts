import { mainPathLevels, playable, skillById, type Access } from "./model";

export function previewGoal(skill: string, access: Access[]) {
  const byLevel = new Map(access.map(entry => [entry.id, entry]));
  const foundations = new Set<string>();
  const remaining: Access[] = [];
  let available = true;
  let count = 0;
  function visit(id: string, goal = false) {
    if (foundations.has(id)) return;
    const definition = skillById.get(id)!;
    const entries = definition.levels.map((_, i) => byLevel.get(`${id}.${i + 1}`));
    const unfinished = entries.filter(entry => entry?.state !== "cleared");
    if (!unfinished.length) return;
    const placed = entries.some(entry => entry?.state === "placed");
    if (!goal && placed) return;
    if (!goal) foundations.add(id);
    if (!placed) definition.prerequisites.forEach(parent => visit(parent));
    count += unfinished.length;
    for (const entry of unfinished) {
      if (!entry || entry.state === "planned") available = false;
      else remaining.push(entry);
    }
  }
  visit(skill, true);
  const complete = available && remaining.length === 0;
  return {
    available, complete, foundations: [...foundations], remaining: count,
    quick: available && !complete && foundations.size <= 1,
    next: available ? remaining.find(playable)?.id : undefined,
  };
}

// Offer one card per destination, previewing its first unfinished level even when a foundation comes first.
export function sideGoals(access: Access[]) {
  const byLevel = new Map(access.map(entry => [entry.id, entry]));
  const seen = new Set<string>();
  const options = [];
  for (const level of mainPathLevels) {
    if (seen.has(level.skill) || byLevel.get(level.id)?.state === "cleared") continue;
    seen.add(level.skill);
    const goal = previewGoal(level.skill, access);
    if (goal.quick && goal.next) options.push({level, goal});
  }
  return options;
}
