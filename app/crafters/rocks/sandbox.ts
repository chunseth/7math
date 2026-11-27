import { miningRules, type RockId } from "../../../lib/crafters/config";
import { beginExpedition } from "../../../lib/crafters/expedition";
import { difficultyTier, rollRock } from "../../../lib/crafters/floor";
import { atlas, coreRockArt, decoyFamilies, type RockAppearance } from "../../../lib/crafters/rock-art";

const openingFloor = 10;
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
  const tier = difficultyTier(openingFloor);
  return beginExpedition(id, now, random, {
    number: openingFloor,
    stairSlot: Math.floor(random() * miningRules.rocksPerFloor),
    rocks: openingRocks.map((type) => rollRock(type, tier, random)),
  });
}

export function previewAppearance(type: RockId, id: string, floor: number, slot: number): RockAppearance {
  const key = `${id}:${floor}:${slot}:`;
  const isOpeningDecoy = floor === openingFloor && slot === 4;
  // Decoys borrow the common granite reward pool. Cosmetics never read the hidden roll.
  const family = isOpeningDecoy ? "crystal-shell"
    : type === "granite" && floor > openingFloor && hash(key + "decoy") % 3 === 0
      ? decoyFamilies[hash(key + "shell") % decoyFamilies.length]
      : coreRockArt[type];

  if ((family === "coal" || family === "iron" || family === "crystal-shell") && hash(key + "hazard") % 4 === 0) {
    return { family, variant: 0, hazard: true };
  }
  return { family, variant: hash(key + "variant") % atlas.families[family].variants.length };
}
