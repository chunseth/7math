import assert from "node:assert/strict";
import { test } from "node:test";
import { miningRules, rockTypes } from "../lib/crafters/config";
import { beginExpedition, canDescend, hasStairs, makeDecision, publicExpedition, recordRockBreak, type Decision, type Expedition } from "../lib/crafters/expedition";
import { difficultyTier, generateFloor, rollExplosion, rollResource, rollRock, type Rock } from "../lib/crafters/floor";
import { atlas, decoyFamilies, rockAppearance, rockFrame } from "../lib/crafters/rock-art";

const high = () => 0.99;

function rock(overrides: Partial<Rock> = {}): Rock {
  return {
    type: "granite", durability: 1, remaining: 1,
    drop: { resource: "stone", quantity: 3 }, explosion: false, ...overrides,
  };
}

function run(stairSlot = 0): Expedition {
  const initial = beginExpedition("expedition", 1000, high);
  return { ...initial, floor: { number: 1, stairSlot, rocks: Array.from({ length: 6 }, () => rock()) } };
}

function play(expedition: Expedition, decision: Decision, at = 1500) {
  const result = makeDecision(expedition, decision, at, high);
  if ("error" in result) throw new Error(result.error);
  return result;
}

test("floor generation uses independent draws, fixed hidden contents, and the configured tiers", () => {
  assert.deepEqual(Array.from({ length: 15 }, (_, i) => difficultyTier(i + 1)), [
    0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4,
  ]);
  for (const type of rockTypes) assert.equal(Object.values(type.drops).reduce<number>((sum, n) => sum + n, 0), 100);
  assert.equal(generateFloor(1, high).rocks[0].type, "copper-flecked");
  assert.equal(generateFloor(3, high).rocks[0].type, "tin-flecked");
  assert.equal(generateFloor(4, high).rocks[0].type, "iron-flecked");
  assert.equal(generateFloor(6, high).rocks[0].type, "crystalline");
  const picks = [0, 0.5, 0.92, 0.5, 0, 0.92];
  for (const stairSlot of picks.keys()) {
    const rolls = [(stairSlot + 0.5) / 6, ...picks.flatMap(pick => [pick, 0.5, 0.25, 0.99])];
    const result = generateFloor(8, () => rolls.shift()!);
    assert.equal(result.stairSlot, stairSlot);
    assert.deepEqual(result.rocks.map(r => r.type), [
      "granite", "copper-flecked", "crystalline", "copper-flecked", "granite", "crystalline",
    ]);
    assert.deepEqual(result.rocks.map(r => r.durability), [3, 4, 5, 4, 3, 5]);
    assert.equal(rolls.length, 0);
  }
  assert.deepEqual(rollResource(rockTypes[0].drops, () => 0), { resource: "stone", quantity: 1 });
  const rolls = [0.7499, 0.999];
  assert.deepEqual(rollResource(rockTypes[0].drops, () => rolls.shift()!), { resource: "stone", quantity: 4 });
  assert.deepEqual(rollResource(rockTypes[5].drops, high), { resource: "gem", quantity: 1 });
  assert.equal(rollExplosion(0.02, 0, () => 0.02), false);
  assert.equal(rollExplosion(0.02, 1, () => 0.025), true);
  assert.equal(rollExplosion(0.08, 4, () => 0.119), true);
});

test("multiple swings, switching rocks, and resuming preserve damage and fixed rolls", () => {
  const initial = run(5);
  initial.floor.rocks[0] = rock({ type: "copper-flecked", durability: 2, remaining: 2, drop: { resource: "copper", quantity: 2 } });
  initial.floor.rocks[1] = rock({ type: "copper-flecked", durability: 2, remaining: 2 });
  const first = play(initial, { action: "swing", slot: 0 });
  assert.equal(first.expedition.energy, miningRules.startingEnergy - 1);
  assert.equal(first.swing?.broken, false);
  assert.equal(first.swing?.drop, null);
  const second = play(first.expedition, { action: "swing", slot: 1 }, 2400);
  assert.equal(second.analytics.elapsedSinceDecisionMs, 900);
  assert.deepEqual(second.expedition.floor.rocks.slice(0, 2).map(r => r.remaining), [1, 1]);
  const restored = JSON.parse(JSON.stringify(second.expedition)) as Expedition;
  const third = play(restored, { action: "swing", slot: 0 }, 3000);
  assert.deepEqual(third.expedition.collected, { copper: 2 });
  assert.equal(third.expedition.mined, 1);
  assert.equal(third.expedition.swings, 3);
  assert.equal(third.expedition.floor.rocks[1].remaining, 1);
  assert.deepEqual(initial.floor.rocks.map(r => r.remaining), [2, 2, 1, 1, 1, 1]);
  assert.equal(publicExpedition(restored).stairSlot, null);
  assert.ok(publicExpedition(restored).rocks.every(r => !("drop" in r) && !("explosion" in r)));
  assert.deepEqual(makeDecision(third.expedition, { action: "swing", slot: 0 }, 3100, high), { error: "spent-rock" });
});

test("stairs can be discovered on the first or last break and are never mandatory", () => {
  for (const stairSlot of [0, 5]) {
    let expedition = run(stairSlot);
    for (let slot = 0; slot <= stairSlot; slot++) {
      const result = play(expedition, { action: "swing", slot });
      expedition = result.expedition;
      assert.equal(result.swing?.stairs, slot === stairSlot);
      assert.equal(hasStairs(expedition.floor), slot === stairSlot);
    }
    assert.equal(expedition.floor.number, 1);
    assert.equal(publicExpedition(expedition).stairSlot, stairSlot);
  }
  assert.equal(canDescend(3, true), false);
  assert.equal(canDescend(4, true), true);
  assert.deepEqual(makeDecision(run(), { action: "descend" }, 1600, high), { error: "no-stairs" });
});

test("descending after a staircase preserves the haul and records abandoned partial rocks", () => {
  const initial = run();
  initial.floor.rocks[2] = rock({ durability: 2, remaining: 2 });
  const staircase = play(initial, { action: "swing", slot: 0 });
  const partial = play(staircase.expedition, { action: "swing", slot: 2 });
  assert.equal(partial.analytics.continuedAfterStairs, true);
  const descend = play(partial.expedition, { action: "descend" });
  assert.equal(descend.expedition.floor.number, 2);
  assert.equal(descend.expedition.energy, 35);
  assert.deepEqual(descend.expedition.collected, { stone: 3 });
  assert.deepEqual(descend.analytics.abandoned, [{ slot: 2, type: "granite", remaining: 1, durability: 2 }]);
  assert.ok(descend.expedition.floor.rocks.every(r => r.remaining === r.durability));
  assert.equal(publicExpedition(descend.expedition).stairSlot, null);
  assert.deepEqual(makeDecision({ ...staircase.expedition, energy: 3 }, { action: "descend" }, 1600, high), { error: "low-energy" });
});

test("return home without stairs secures everything and records remaining energy", () => {
  const initial = run(5);
  const mined = play(initial, { action: "swing", slot: 0 });
  const result = play(mined.expedition, { action: "return" }, 12_000);
  assert.deepEqual(result.summary, {
    id: initial.id, outcome: "returned", deepestFloor: 1, rocksMined: 1, swings: 1, hazards: 0,
    collected: { stone: 3 }, lost: {}, secured: { stone: 3 }, durationMs: 11_000,
    energyRemaining: 39, energyUsed: 1, resourcesPerEnergy: 3,
  });
  assert.equal(result.analytics.staircaseDiscoveredBefore, false);
  assert.equal(result.analytics.energyBefore, 39);
});

test("a rock can roll a staircase, a drop, and an explosion at the same time", () => {
  const initial = run();
  initial.floor.rocks[0].explosion = true;
  const result = play(initial, { action: "swing", slot: 0 });
  assert.deepEqual(result.swing, {
    floor: 1, slot: 0, remaining: 0, broken: true, drop: { resource: "stone", quantity: 3 }, stairs: true, explosion: true,
  });
  assert.equal(result.expedition.energy, 34);
  assert.equal(result.expedition.hazards, 1);
  assert.equal(result.summary, null);
});

test("normal and explosive exhaustion settle once and round each resource independently", () => {
  const weak = { ...run(), energy: 1, collected: { coal: 3, copper: 2, gem: 1 } };
  const normal = play(weak, { action: "swing", slot: 0 });
  assert.equal(normal.expedition.energy, 0);
  assert.equal(normal.summary?.outcome, "passed_out");
  assert.deepEqual(normal.summary?.secured, { stone: 1, coal: 1, copper: 1 });
  assert.deepEqual(normal.summary?.lost, { stone: 2, coal: 2, copper: 1, gem: 1 });
  assert.deepEqual(makeDecision(normal.expedition, { action: "return" }, 3000, high), { error: "finished" });
  const explosive = { ...run(), energy: 5 };
  explosive.floor.rocks[0].explosion = true;
  const blast = play(explosive, { action: "swing", slot: 0 });
  assert.equal(blast.expedition.energy, 0);
  assert.equal(blast.summary?.outcome, "passed_out");
  assert.equal(blast.summary?.hazards, 1);
  assert.equal(blast.summary?.energyUsed, 40);
  assert.equal(blast.swing?.stairs, true);
});

test("catalogue tracks counts, per-resource hit frequencies and quantities, and hazards", () => {
  const copper = recordRockBreak(undefined, { resource: "copper", quantity: 3 }, true);
  const gem = recordRockBreak(copper, { resource: "gem", quantity: 1 }, false);
  assert.deepEqual(recordRockBreak(gem, { resource: "copper", quantity: 1 }, true), {
    mined: 3, hazards: 2, drops: { copper: { hits: 2, units: 4 }, gem: { hits: 1, units: 1 } },
  });
  assert.equal(copper.mined, 1);
});

test("every damage stage is reachable and art stays fixed through damage and reload", () => {
  assert.deepEqual([4, 3, 2, 1, 0].map(remaining => rockFrame({ durability: 4, remaining })), [0, 1, 2, 3, 4]);
  assert.equal(rockFrame({ durability: 2, remaining: 1 }), 3);
  assert.equal(rockFrame({ durability: 1, remaining: 1 }), 0);
  const scene = run(5);
  scene.floor.rocks[0] = rock({ durability: 4, remaining: 4, explosion: true });
  const appearance = publicExpedition(scene).rocks[0].appearance;
  let next = scene;
  for (let remaining = 3; remaining >= 0; remaining--) {
    next = play(next, { action: "swing", slot: 0 }).expedition;
    const visible = publicExpedition(JSON.parse(JSON.stringify(next)) as Expedition).rocks[0];
    assert.deepEqual(visible.appearance, appearance);
    assert.equal(visible.exploded, remaining === 0 ? true : undefined);
    assert.ok(!("drop" in visible) && !("explosion" in visible));
  }
});

test("decoys and pressure cues are cosmetic and pressure cues leave both outcomes possible", () => {
  const looks = Array.from({ length: 240 }, (_, i) => rockAppearance("granite", `preview-${i}`, 1, i % 6));
  for (const family of decoyFamilies) {
    const variants = looks.filter(look => look.family === family).map(look => look.variant);
    assert.equal(new Set(variants).size, atlas.families[family].variants.length);
  }
  for (const [hazardRoll, explosion, hints] of [
    [.01, true, true], [.05, true, false], [.1, false, true], [.8, false, false],
  ] as const) {
    const rolls = [.55, .5, hazardRoll];
    const result = rollRock("iron-flecked", 0, () => rolls.shift()!);
    const visible = rockAppearance(result.type, "preview", 4, 0, result.hazardHint);
    assert.equal(result.explosion, explosion);
    assert.equal(Boolean(visible.hazard), hints);
    assert.deepEqual(result.drop, { resource: "iron", quantity: 2 });
    assert.equal(result.durability, 2);
  }
});
