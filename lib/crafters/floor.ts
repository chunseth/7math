import { miningResources, miningRules, resourceIds, rockType, rockTypes, type MiningResource, type RockId } from "./config";

export type Random = () => number;
export type Drop = { resource: MiningResource; quantity: number };
export type Rock = {
  type: RockId;
  durability: number;
  remaining: number;
  drop: Drop;
  explosion: boolean;
};
export type MineFloor = { number: number; stairSlot: number; rocks: Rock[] };

function weighted<T>(entries: readonly T[], weight: (entry: T) => number, random: Random): T {
  let roll = random() * entries.reduce((total, entry) => total + weight(entry), 0);
  for (const entry of entries) {
    roll -= weight(entry);
    if (roll < 0) return entry;
  }
  throw new Error("Mining weights require a nonempty distribution and a roll in [0, 1).");
}

export function difficultyTier(floor: number) {
  return Math.floor((floor - 1) / miningRules.floorsPerTier);
}

export function rollResource(drops: Record<MiningResource, number>, random: Random): Drop {
  const resource = weighted(resourceIds, id => drops[id], random);
  const { min, max } = miningResources[resource];
  return { resource, quantity: min + Math.floor(random() * (max - min + 1)) };
}

export function rollExplosion(base: number, tier: number, random: Random) {
  return random() < Math.min(1, base + tier * miningRules.explosionChancePerTier);
}

export function rollRock(id: RockId, tier: number, random: Random): Rock {
  const type = rockType(id);
  const durability = type.durability + tier * miningRules.durabilityPerTier;
  return {
    type: id,
    durability,
    remaining: durability,
    drop: rollResource(type.drops, random),
    explosion: rollExplosion(type.explosion, tier, random),
  };
}

export function generateFloor(number: number, random: Random): MineFloor {
  const tier = difficultyTier(number);
  const available = rockTypes.filter((rock: (typeof rockTypes)[number] & { lastFloor: number | null }) =>
    number >= rock.firstFloor && (rock.lastFloor === null || number <= rock.lastFloor));
  const stairSlot = Math.floor(random() * miningRules.rocksPerFloor);
  const rocks = Array.from({ length: miningRules.rocksPerFloor }, (): Rock => {
    const type = weighted(available, rock => rock.weight, random);
    return rollRock(type.id, tier, random);
  });
  return { number, stairSlot, rocks };
}
