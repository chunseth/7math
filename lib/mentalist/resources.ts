export type ResourceNode = {
  id: string;
  name: string;
  oreId: string;
  oreName: string;
  cost: number;
  x: number;
  y: number;
};

export type MiningJob = {
  resourceName: string;
  oreId: string;
  oreName: string;
  completeAt: number;
};

export const MAX_STAMINA = 20;
export const MINE_DURATION_MS = 10000;
export const STAMINA_REFILL_MS = 5 * 60 * 1000;

export const resources: ResourceNode[] = [
  { id: "copper-ridge", name: "Copper Ridge", oreId: "copper", oreName: "Copper Ore", cost: 4, x: 12, y: 18 },
  { id: "tin-hollow", name: "Tin Hollow", oreId: "tin", oreName: "Tin Ore", cost: 3, x: 34, y: 12 },
  { id: "iron-falls", name: "Iron Falls", oreId: "iron", oreName: "Iron Ore", cost: 5, x: 61, y: 20 },
  { id: "silver-cairn", name: "Silver Cairn", oreId: "silver", oreName: "Silver Ore", cost: 6, x: 82, y: 34 },
  { id: "coal-vein", name: "Coal Vein", oreId: "coal", oreName: "Coal", cost: 2, x: 22, y: 45 },
  { id: "quartz-field", name: "Quartz Field", oreId: "quartz", oreName: "Quartz", cost: 4, x: 49, y: 52 },
  { id: "gold-pocket", name: "Gold Pocket", oreId: "gold", oreName: "Gold Ore", cost: 8, x: 73, y: 62 },
  {
    id: "crystal-crag",
    name: "Crystal Crag",
    oreId: "crystal",
    oreName: "Crystal Ore",
    cost: 7,
    x: 41,
    y: 78,
  },
];
