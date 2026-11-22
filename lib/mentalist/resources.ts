export type ResourceNode = {
  id: string;
  name: string;
  oreId: string;
  oreName: string;
  cost: number;
  tier: number;
};

export const MAX_ENERGY = 20;
export const MINE_DURATION_MS = 10_000;
export const ENERGY_REFILL_MS = 5 * 60_000;

export const resources: ResourceNode[] = [
  { id: "coal-vein", name: "Coal Vein", oreId: "coal", oreName: "Coal", cost: 2, tier: 0 },
  { id: "tin-hollow", name: "Tin Hollow", oreId: "tin", oreName: "Tin Ore", cost: 3, tier: 0 },
  { id: "copper-ridge", name: "Copper Ridge", oreId: "copper", oreName: "Copper Ore", cost: 4, tier: 0 },
  { id: "iron-falls", name: "Iron Falls", oreId: "iron", oreName: "Iron Ore", cost: 5, tier: 1 },
  { id: "quartz-field", name: "Quartz Field", oreId: "quartz", oreName: "Quartz", cost: 4, tier: 1 },
  { id: "silver-cairn", name: "Silver Cairn", oreId: "silver", oreName: "Silver Ore", cost: 6, tier: 2 },
  { id: "gold-pocket", name: "Gold Pocket", oreId: "gold", oreName: "Gold Ore", cost: 8, tier: 2 },
  { id: "crystal-crag", name: "Crystal Crag", oreId: "crystal", oreName: "Crystal Ore", cost: 7, tier: 2 },
];

type Recipe = { id: string; name: string; ingredients: Record<string, number> };
type Pickaxe = Recipe & { slot: "pickaxe"; tier: number; discount: number };
type Sword = Recipe & { slot: "sword"; damage: number };

export const pickaxes: Pickaxe[] = [
  { id: "copper-pickaxe", name: "Copper Pickaxe", slot: "pickaxe", tier: 1, discount: 1, ingredients: { copper: 2, tin: 1 } },
  { id: "iron-pickaxe", name: "Iron Pickaxe", slot: "pickaxe", tier: 2, discount: 2, ingredients: { iron: 2, coal: 1 } },
  { id: "crystal-pickaxe", name: "Crystal Pickaxe", slot: "pickaxe", tier: 3, discount: 3, ingredients: { crystal: 2, gold: 1 } },
];
export const swords: Sword[] = [
  { id: "copper-sword", name: "Copper Sword", slot: "sword", damage: 3, ingredients: { copper: 2 } },
  { id: "iron-sword", name: "Iron Sword", slot: "sword", damage: 5, ingredients: { iron: 2, coal: 1 } },
  { id: "silver-sword", name: "Silver Sword", slot: "sword", damage: 7, ingredients: { silver: 2, quartz: 1 } },
  { id: "crystal-sword", name: "Crystal Sword", slot: "sword", damage: 9, ingredients: { crystal: 2, gold: 1 } },
];

export const tools = [...pickaxes, ...swords];
export type ToolSlot = (typeof tools)[number]["slot"];
export type Equipment = {
  ownedTools: string[];
  equippedPickaxe: string | null;
  equippedSword: string | null;
};

export type CraftState = {
  energy: number;
  refilledAt: number;
  serverNow: number;
  job: { node: string; oreName: string; completeAt: number } | null;
  inventory: Record<string, number>;
  equipment: Equipment;
  collectedOre: string | null;
};

export function energyAt(energy: number, refilledAt: number, now: number) {
  const ticks = Math.floor(Math.max(0, now - refilledAt) / ENERGY_REFILL_MS);
  return {
    energy: Math.min(MAX_ENERGY, energy + ticks),
    refilledAt: refilledAt + ticks * ENERGY_REFILL_MS,
  };
}

export function miningCost(node: ResourceNode, pickaxe?: Pickaxe) {
  return Math.max(1, node.cost - (pickaxe?.discount ?? 0));
}
