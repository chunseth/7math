import type { RockId } from "./config";
import atlas from "./rock-atlas.json";

export { atlas };
export type RockFamily = keyof typeof atlas.families;
export type HazardFamily = keyof typeof atlas.hazards;
export type RockFrame = 0 | 1 | 2 | 3 | 4;

export const coreRockArt: Record<RockId, RockFamily> = {
  granite: "granite",
  "coal-flecked": "coal",
  "copper-flecked": "copper",
  "tin-flecked": "tin",
  "iron-flecked": "iron",
  crystalline: "crystal",
};

export const decoyFamilies = ["false-glint", "shiny-surface", "crystal-shell"] as const;
export const hazardFamilies = Object.keys(atlas.hazards) as HazardFamily[];

export type RockAppearance =
  | { family: RockFamily; variant: number; hazard?: false }
  | { family: HazardFamily; variant: 0; hazard: true };

function artRoll(key: string) {
  let value = 2166136261;
  for (const letter of key) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
  return (value ^ (value >>> 16)) >>> 0;
}

export function rockAppearance(type: RockId, expedition: string, floor: number, slot: number, hazardHint = false,
  showcaseFamily?: RockFamily,
): RockAppearance {
  const key = `${expedition}:${floor}:${slot}:`;
  // Decoys use the granite reward pool. Their silhouettes and variants stay fixed through damage and reloads.
  const family = showcaseFamily ?? (type === "granite" && artRoll(key + "decoy") % 4 === 0
    ? decoyFamilies[artRoll(key + "shell") % decoyFamilies.length]
    : coreRockArt[type]);
  if (hazardHint && (family === "coal" || family === "iron" || family === "crystal-shell")) {
    return { family, variant: 0, hazard: true };
  }
  return { family, variant: artRoll(key + "variant") % atlas.families[family].variants.length };
}

export function rockFrame({ remaining, durability }: { remaining: number; durability: number }): RockFrame {
  if (remaining <= 0) return 4;
  if (remaining === durability) return 0;
  if (remaining === 1) return 3;
  return (durability - remaining) * 2 >= durability ? 2 : 1;
}
