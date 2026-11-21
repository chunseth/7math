import type { PoolClient } from "pg";
import { GameError, one, rows, type Identity } from "./db";
import { resources, MAX_STAMINA, STAMINA_REFILL_MS, MINE_DURATION_MS } from "./resources";
export async function craft(db: PoolClient, who: Identity, b: Record<string, unknown>) {
  const p = who.profile;
  await db.query("insert into public.crafters_progress(profile_id) values($1) on conflict do nothing", [p]);
  let progress = await one(db, "select * from public.crafters_progress where profile_id=$1 for update", [p]);
  const ticks = Math.max(
    0,
    Math.floor((Date.now() - new Date(progress.stamina_refilled_at).getTime()) / STAMINA_REFILL_MS),
  );
  const stamina = Math.min(MAX_STAMINA, progress.stamina + ticks);
  if (b.action === "mine") {
    const node = resources.find((n) => n.id === b.node);
    if (!node || progress.mining_complete_at || stamina < node.cost) throw new GameError("Site unavailable.");
    progress = await one(
      db,
      `update public.crafters_progress set stamina=$2,stamina_refilled_at=$3,active_mining_resource_id=$4,active_mining_resource_name=$5,active_mining_ore_id=$6,active_mining_ore_name=$7,mining_complete_at=$8 where profile_id=$1 returning *`,
      [
        p,
        stamina - node.cost,
        stamina === MAX_STAMINA
          ? new Date()
          : new Date(+new Date(progress.stamina_refilled_at) + ticks * STAMINA_REFILL_MS),
        node.id,
        node.name,
        node.oreId,
        node.oreName,
        new Date(Date.now() + MINE_DURATION_MS),
      ],
    );
  } else if (
    b.action === "collect" &&
    progress.mining_complete_at &&
    +new Date(progress.mining_complete_at) <= Date.now()
  ) {
    await db.query(
      `insert into public.crafters_inventory(profile_id,ore_id,ore_name,quantity) values($1,$2,$3,1) on conflict(profile_id,ore_id) do update set quantity=crafters_inventory.quantity+1`,
      [p, progress.active_mining_ore_id, progress.active_mining_ore_name],
    );
    progress = await one(
      db,
      "update public.crafters_progress set active_mining_resource_id=null,active_mining_resource_name=null,active_mining_ore_id=null,active_mining_ore_name=null,mining_complete_at=null where profile_id=$1 returning *",
      [p],
    );
  } else if (!["collect", "craftState"].includes(String(b.action)))
    throw new GameError("Unknown crafting action.");
  return {
    progress,
    inventory: await rows(
      db,
      "select * from public.crafters_inventory where profile_id=$1 order by ore_name",
      [p],
    ),
  };
}
