import { miningRules, resourceIds, type MiningResource, type RockId } from "./config";
import { generateFloor, type Drop, type MineFloor, type Random, type Rock } from "./floor";

export type Resources = Partial<Record<MiningResource, number>>;
export type Expedition = {
  id: string;
  revision: number;
  floor: MineFloor;
  energy: number;
  maxEnergy: number;
  collected: Resources;
  swings: number;
  mined: number;
  hazards: number;
  startedAt: number;
  lastDecisionAt: number;
};
export type Outcome = "returned" | "passed_out";

export type ExpeditionSummary = {
  id: string;
  outcome: Outcome;
  deepestFloor: number;
  rocksMined: number;
  swings: number;
  hazards: number;
  collected: Resources;
  lost: Resources;
  secured: Resources;
  durationMs: number;
  energyRemaining: number;
  energyUsed: number;
  resourcesPerEnergy: number | null;
};

export type SwingResult = {
  floor: number;
  slot: number;
  broken: boolean;
  remaining: number;
  drop: Drop | null;
  explosion: boolean;
  stairs: boolean;
};

export type Decision = { action: "swing"; slot: number } | { action: "descend" | "return" };
export type DecisionError = "spent-rock" | "no-stairs" | "low-energy" | "finished";

export type ExpeditionTransition =
  | { error: DecisionError }
  | {
    expedition: Expedition;
    swing: SwingResult | null;
    summary: ExpeditionSummary | null;
    analytics: Record<string, unknown>;
  };

export function beginExpedition(id: string, now: number, random: Random, floor = generateFloor(1, random)): Expedition {
  return {
    id, revision: 0, floor, energy: miningRules.startingEnergy,
    maxEnergy: miningRules.startingEnergy, collected: {}, swings: 0, mined: 0, hazards: 0,
    startedAt: now, lastDecisionAt: now,
  };
}

export function hasStairs(floor: MineFloor) {
  return floor.rocks[floor.stairSlot].remaining === 0;
}

export function canDescend(energy: number, stairs: boolean) {
  return stairs && energy > miningRules.descentCost;
}

function spend(energy: number, cost: number) {
  return Math.max(0, energy - cost);
}

function partiallyMined(floor: MineFloor) {
  return floor.rocks.flatMap((rock, slot) => rock.remaining > 0 && rock.remaining < rock.durability
    ? [{ slot, type: rock.type, remaining: rock.remaining, durability: rock.durability }]
    : []);
}

export function settleExpedition(expedition: Expedition, outcome: Outcome, now: number): ExpeditionSummary {
  const secured: Resources = {};
  const lost: Resources = {};
  for (const resource of resourceIds) {
    const count = expedition.collected[resource] ?? 0;
    if (count === 0) continue;
    const retained = outcome === "returned" ? count : Math.floor(count * miningRules.passOutRetention);
    if (retained > 0) secured[resource] = retained;
    if (count > retained) lost[resource] = count - retained;
  }
  const energyUsed = expedition.maxEnergy - expedition.energy;
  const total = Object.values(expedition.collected).reduce((sum, count) => sum + count, 0);
  return {
    id: expedition.id, outcome, deepestFloor: expedition.floor.number, rocksMined: expedition.mined,
    swings: expedition.swings, hazards: expedition.hazards, collected: expedition.collected, lost, secured,
    durationMs: Math.max(0, now - expedition.startedAt), energyRemaining: expedition.energy, energyUsed,
    resourcesPerEnergy: energyUsed > 0 ? total / energyUsed : null,
  };
}

export function makeDecision(
  current: Expedition, decision: Decision, now: number, random: Random,
): ExpeditionTransition {
  if (current.energy <= 0) return { error: "finished" };
  const stairsAlreadyFound = hasStairs(current.floor);
  const expedition: Expedition = {
    ...current, revision: current.revision + 1, lastDecisionAt: now,
  };
  const analytics: Record<string, unknown> = {
    revision: expedition.revision,
    floor: current.floor.number,
    energyBefore: current.energy,
    elapsedSinceDecisionMs: Math.max(0, now - current.lastDecisionAt),
    staircaseDiscoveredBefore: stairsAlreadyFound,
  };
  let swing: SwingResult | null = null;
  if (decision.action === "swing") {
    const rock = current.floor.rocks[decision.slot];
    if (!rock || rock.remaining <= 0) return { error: "spent-rock" };
    const remaining = rock.remaining - 1;
    const rocks = [...current.floor.rocks];
    rocks[decision.slot] = { ...rock, remaining };
    expedition.floor = { ...current.floor, rocks };
    expedition.swings++;
    expedition.energy = spend(current.energy, miningRules.swingCost);
    const broken = remaining === 0;
    swing = {
      floor: current.floor.number, slot: decision.slot, broken, remaining,
      drop: broken ? rock.drop : null, explosion: broken && rock.explosion,
      stairs: broken && current.floor.stairSlot === decision.slot,
    };
    if (swing.drop) {
      expedition.mined++;
      expedition.collected = {
        ...current.collected, [rock.drop.resource]: (current.collected[rock.drop.resource] ?? 0) + rock.drop.quantity,
      };
    }
    if (swing.explosion) {
      expedition.hazards++;
      expedition.energy = spend(expedition.energy, miningRules.explosionCost);
    }
    Object.assign(analytics, {
      ...swing, type: rock.type, swingNumber: expedition.swings, rockMinedNumber: broken ? expedition.mined : null,
      continuedAfterStairs: stairsAlreadyFound,
    });
  } else if (decision.action === "descend") {
    if (!stairsAlreadyFound) return { error: "no-stairs" };
    if (!canDescend(current.energy, stairsAlreadyFound)) return { error: "low-energy" };
    expedition.energy = spend(current.energy, miningRules.descentCost);
    expedition.floor = generateFloor(current.floor.number + 1, random);
    analytics.abandoned = partiallyMined(current.floor);
    analytics.descendedTo = expedition.floor.number;
  }

  const outcome = decision.action === "return" ? "returned" : expedition.energy === 0 ? "passed_out" : null;
  const summary = outcome ? settleExpedition(expedition, outcome, now) : null;
  analytics.energyAfter = expedition.energy;
  if (summary) {
    analytics.outcome = outcome;
    analytics.abandoned = partiallyMined(expedition.floor);
    analytics.resourcesPerEnergy = summary.resourcesPerEnergy;
  }
  return { expedition, summary, swing, analytics };
}

export type RockHistory = { mined: number; hazards: number; drops: Partial<Record<MiningResource, { hits: number; units: number }>> };
export type PublicRock = Pick<Rock, "type" | "durability" | "remaining">;

export function publicExpedition(expedition: Expedition) {
  const { floor, lastDecisionAt: _lastDecisionAt, ...visible } = expedition;
  return {
    ...visible,
    floor: floor.number,
    stairSlot: hasStairs(floor) ? floor.stairSlot : null,
    rocks: floor.rocks.map(({ type, durability, remaining }): PublicRock => ({ type, durability, remaining })),
  };
}

export type MiningView = {
  active: ReturnType<typeof publicExpedition> | null;
  latest: ExpeditionSummary | null;
  inventory: { id: string; name: string; quantity: number }[];
  catalogue: Partial<Record<RockId, RockHistory>>;
  stats: { expeditions: number; returned: number; passedOut: number; deepestFloor: number };
  swing: SwingResult | null;
};

export function recordRockBreak(history: RockHistory | undefined, drop: Drop, explosion: boolean): RockHistory {
  const previous = history?.drops[drop.resource];
  return {
    mined: (history?.mined ?? 0) + 1,
    hazards: (history?.hazards ?? 0) + Number(explosion),
    drops: { ...history?.drops, [drop.resource]: { hits: (previous?.hits ?? 0) + 1, units: (previous?.units ?? 0) + drop.quantity } },
  };
}
