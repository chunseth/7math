import { currentLevel, levels, skillById } from "../mentalist/model";

export type SurvivorQuestion = { id: string; prompt: string; answer: string };
export type SurvivorTopic = { id: string; title: string; questions: SurvivorQuestion[] };
export type SurvivorPack = { sprite: string; topics: SurvivorTopic[] };

export function completedSurvivorLevels(published: Iterable<string>, cleared: Iterable<string>) {
  const live = new Set(published);
  const passed = new Set(Array.from(cleared, currentLevel));
  return levels.filter(level => {
    const skill = skillById.get(level.skill)!;
    return skill.levels.every((_, index) => {
      const id = `${skill.id}.${index + 1}`;
      return live.has(id) && passed.has(id);
    });
  }).map(level => level.id);
}
