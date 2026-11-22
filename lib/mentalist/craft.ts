import type { PoolClient } from "pg";
import type { CraftersProgress } from "../database.types";
import { GameError, one, rows, type Identity } from "./db";
import {
  energyAt, MAX_ENERGY, MINE_DURATION_MS, miningCost, pickaxes, resources, swords, tools,
  type CraftState, type Equipment, type ToolSlot,
} from "./resources";

export async function equipment(db: PoolClient, profile: string): Promise<Equipment> {
  const owned = await rows<{ tool_id: string; slot: ToolSlot; equipped: boolean }>(
    db, "select tool_id,slot,equipped from crafted_tools where profile=$1", [profile],
  );
  return {
    ownedTools: owned.map((item) => item.tool_id),
    equippedPickaxe: owned.find((item) => item.equipped && item.slot === "pickaxe")?.tool_id ?? null,
    equippedSword: owned.find((item) => item.equipped && item.slot === "sword")?.tool_id ?? null,
  };
}

export async function swordDamage(db: PoolClient, profile: string) {
  const [item] = await rows<{ tool_id: string }>(
    db, "select tool_id from crafted_tools where profile=$1 and slot='sword' and equipped", [profile],
  );
  return swords.find((sword) => sword.id === item?.tool_id)?.damage ?? 0;
}

export async function equipTool(db: PoolClient, profile: string, slot: ToolSlot, tool: unknown) {
  if (tool !== "") {
    const [owned] = await rows(db, "select 1 from crafted_tools where profile=$1 and tool_id=$2 and slot=$3", [
      profile, typeof tool === "string" ? tool : null, slot,
    ]);
    if (!owned) throw new GameError("Craft this tool before equipping it.");
  }
  await db.query("update crafted_tools set equipped=false where profile=$1 and slot=$2 and equipped", [
    profile, slot,
  ]);
  if (tool !== "")
    await db.query("update crafted_tools set equipped=true where profile=$1 and tool_id=$2", [profile, tool]);
}

async function craftTool(db: PoolClient, profile: string, id: unknown) {
  const tool = tools.find((recipe) => recipe.id === id);
  if (!tool) throw new GameError("Unknown recipe.");
  const inserted = await db.query(
    "insert into crafted_tools(profile,tool_id,slot) values($1,$2,$3) on conflict do nothing",
    [profile, tool.id, tool.slot],
  );
  if (!inserted.rowCount) return;
  for (const [ore, cost] of Object.entries(tool.ingredients)) {
    const spent = await db.query(
      "update public.crafters_inventory set quantity=quantity-$3 where profile_id=$1 and ore_id=$2 and quantity>=$3",
      [profile, ore, cost],
    );
    if (!spent.rowCount) throw new GameError("You need more ore for this recipe.", 409);
  }
}

// Call inside an authenticated transaction. The profile lock in identity serializes all game actions.
export async function craft(db: PoolClient, who: Identity, b: Record<string, unknown>): Promise<CraftState> {
  const profile = who.profile;
  await db.query("insert into public.crafters_progress(profile_id) values($1) on conflict do nothing", [profile]);
  let progress = await one<CraftersProgress>(
    db, "select * from public.crafters_progress where profile_id=$1 for update", [profile],
  );
  const now = Date.now();
  let energy = energyAt(progress.stamina, +new Date(progress.stamina_refilled_at), now);
  let collectedOre: string | null = null;
  if (progress.mining_complete_at && +new Date(progress.mining_complete_at) <= now &&
      progress.active_mining_ore_id && progress.active_mining_ore_name) {
    collectedOre = progress.active_mining_ore_name;
    await db.query(
      `insert into public.crafters_inventory(profile_id,ore_id,ore_name,quantity) values($1,$2,$3,1)
       on conflict(profile_id,ore_id) do update set quantity=crafters_inventory.quantity+1`,
      [profile, progress.active_mining_ore_id, collectedOre],
    );
    progress = await one<CraftersProgress>(
      db,
      `update public.crafters_progress set active_mining_resource_id=null,active_mining_resource_name=null,
       active_mining_ore_id=null,active_mining_ore_name=null,mining_complete_at=null where profile_id=$1 returning *`,
      [profile],
    );
  }
  if (b.action === "mine") {
    const node = resources.find((resource) => resource.id === b.node);
    if (!node) throw new GameError("Unknown ore.");
    if (progress.mining_complete_at) throw new GameError("Mining is already underway.", 409);
    const gear = await equipment(db, profile);
    const pickaxe = pickaxes.find((item) => item.id === gear.equippedPickaxe);
    if (node.tier > (pickaxe?.tier ?? 0)) throw new GameError("Equip a stronger pickaxe to mine this ore.", 409);
    const cost = miningCost(node, pickaxe);
    if (energy.energy < cost) throw new GameError("You need more energy to mine this ore.", 409);
    energy = { energy: energy.energy - cost, refilledAt: energy.energy === MAX_ENERGY ? now : energy.refilledAt };
    progress = await one<CraftersProgress>(
      db,
      `update public.crafters_progress set stamina=$2,stamina_refilled_at=$3,active_mining_resource_id=$4,
       active_mining_resource_name=$5,active_mining_ore_id=$6,active_mining_ore_name=$7,mining_complete_at=$8
       where profile_id=$1 returning *`,
      [profile, energy.energy, new Date(energy.refilledAt), node.id, node.name, node.oreId, node.oreName,
        new Date(now + MINE_DURATION_MS)],
    );
  } else if (b.action === "craftTool") {
    await craftTool(db, profile, b.tool);
  } else if (b.action === "equipPickaxe") {
    await equipTool(db, profile, "pickaxe", b.tool);
  } else if (b.action !== "collect" && b.action !== "craftState") {
    throw new GameError("Unknown crafting action.");
  }
  const inventory = await rows<{ ore_id: string; quantity: number }>(
    db, "select ore_id,quantity from public.crafters_inventory where profile_id=$1", [profile],
  );
  return {
    ...energy,
    serverNow: now,
    job: progress.mining_complete_at && progress.active_mining_resource_id && progress.active_mining_ore_name
      ? { node: progress.active_mining_resource_id, oreName: progress.active_mining_ore_name, completeAt: +new Date(progress.mining_complete_at) }
      : null,
    inventory: Object.fromEntries(inventory.map((item) => [item.ore_id, item.quantity])),
    equipment: await equipment(db, profile),
    collectedOre,
  };
}
