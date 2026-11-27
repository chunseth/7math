import { miningRules, type RockId } from "../../../lib/crafters/config";
import { beginExpedition } from "../../../lib/crafters/expedition";
import { difficultyTier, rollRock } from "../../../lib/crafters/floor";

export const openingPreviewFloor = 10;
const openingRocks: RockId[] = ["granite", "coal-flecked", "copper-flecked", "iron-flecked", "granite", "crystalline"];

function hash(key: string) {
  let value = 2166136261;
  for (const letter of key) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
  return value >>> 0;
}

export function startPreview(id: string, now: number) {
  let state = hash(id);
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const tier = difficultyTier(openingPreviewFloor);
  return beginExpedition(id, now, random, {
    number: openingPreviewFloor,
    stairSlot: Math.floor(random() * miningRules.rocksPerFloor),
    rocks: openingRocks.map((type) => rollRock(type, tier, random)),
  });
}
