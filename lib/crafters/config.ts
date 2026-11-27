export const miningRules = {
  startingEnergy: 40,
  rocksPerFloor: 6,
  swingCost: 1,
  descentCost: 3,
  explosionCost: 5,
  floorsPerTier: 3,
  durabilityPerTier: 1,
  explosionChancePerTier: 0.01,
  passOutRetention: 0.5,
  observedSampleSize: 20,
} as const;

export const miningResources = {
  stone: { name: "Stone", min: 1, max: 4 },
  coal: { name: "Coal", min: 1, max: 3 },
  copper: { name: "Copper", min: 1, max: 3 },
  tin: { name: "Tin", min: 1, max: 3 },
  iron: { name: "Iron", min: 1, max: 3 },
  gem: { name: "Gem", min: 1, max: 1 },
} as const;

export type MiningResource = keyof typeof miningResources;
export const resourceIds = Object.keys(miningResources) as MiningResource[];

export type RockDefinition = {
  id: string;
  name: string;
  visual: string;
  durability: number;
  firstFloor: number;
  lastFloor: number | null;
  weight: number;
  drops: Record<MiningResource, number>;
  explosion: number;
};

export const rockTypes = [
  { id: "granite", name: "Granite", visual: "granite", durability: 1, firstFloor: 1, lastFloor: null, weight: 34,
    drops: { stone: 75, coal: 15, copper: 8, tin: 1, iron: 1, gem: 0 }, explosion: 0.02 },
  { id: "coal-flecked", name: "Coal-flecked rock", visual: "coal", durability: 1, firstFloor: 1, lastFloor: null, weight: 26,
    drops: { stone: 25, coal: 65, copper: 8, tin: 2, iron: 0, gem: 0 }, explosion: 0.03 },
  { id: "copper-flecked", name: "Copper-flecked rock", visual: "copper", durability: 2, firstFloor: 1, lastFloor: null, weight: 24,
    drops: { stone: 20, coal: 10, copper: 65, tin: 5, iron: 0, gem: 0 }, explosion: 0.04 },
  { id: "tin-flecked", name: "Tin-flecked rock", visual: "tin", durability: 2, firstFloor: 3, lastFloor: null, weight: 20,
    drops: { stone: 20, coal: 5, copper: 10, tin: 60, iron: 5, gem: 0 }, explosion: 0.05 },
  { id: "iron-flecked", name: "Iron-flecked rock", visual: "iron", durability: 2, firstFloor: 4, lastFloor: null, weight: 18,
    drops: { stone: 15, coal: 10, copper: 5, tin: 5, iron: 65, gem: 0 }, explosion: 0.06 },
  { id: "crystalline", name: "Crystalline rock", visual: "crystal", durability: 3, firstFloor: 6, lastFloor: null, weight: 15,
    drops: { stone: 25, coal: 0, copper: 5, tin: 5, iron: 15, gem: 50 }, explosion: 0.08 },
] as const satisfies readonly RockDefinition[];

export type RockId = (typeof rockTypes)[number]["id"];

export function rockType(id: RockId): RockDefinition {
  return rockTypes.find(rock => rock.id === id)!;
}

export const rockDefinitions: readonly (RockDefinition & { id: RockId })[] = rockTypes;
