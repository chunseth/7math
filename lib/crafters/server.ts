import { randomInt, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { GameError, one, rows, uuid, type Identity } from "../mentalist/db";
import { miningResources, miningRules, rockTypes, type RockId } from "./config";
import {
  beginExpedition, makeDecision, publicExpedition, recordRockBreak,
  type Decision, type DecisionError, type Expedition, type ExpeditionTransition,
  type MiningView, type RockHistory,
} from "./expedition";

const random = () => randomInt(2 ** 30) / 2 ** 30;
const stale = () => new GameError("This expedition changed. Refresh to continue.", 409);

const decisionErrors: Record<DecisionError, string> = {
  "spent-rock": "This rock has already been mined.",
  "no-stairs": "Find the stairs before descending.",
  "low-energy": "You need more energy to descend.",
  "finished": "This expedition has already ended.",
};

export async function loadMining(db: PoolClient, profile: string): Promise<MiningView> {
  const state = await one<Omit<MiningView, "active" | "swing"> & { active: Expedition | null }>(db, `
    select
      (select state from mining_expeditions where profile=$1 and status='active') as active,
      (select summary from mining_expeditions where profile=$1 and ended_at is not null
       order by ended_at desc,id limit 1) as latest,
      coalesce((select jsonb_agg(jsonb_build_object('id',ore_id,'name',ore_name,'quantity',quantity) order by ore_id)
        from public.crafters_inventory where profile_id=$1 and quantity>0), '[]'::jsonb) as inventory,
      coalesce((select jsonb_object_agg(rock,history) from mining_rock_stats where profile=$1), '{}'::jsonb) as catalogue,
      (select jsonb_build_object(
        'expeditions', count(*) filter (where status<>'active'),
        'returned', count(*) filter (where status='returned'),
        'passedOut', count(*) filter (where status='passed_out'),
        'deepestFloor', coalesce(max(deepest_floor),0)
      ) from mining_expeditions where profile=$1) as stats
  `, [profile]);
  return { ...state, active: state.active ? publicExpedition(state.active) : null, swing: null };
}

async function logEvent(
  db: PoolClient, profile: string, expedition: string | null, kind: string,
  now: number, details: Record<string, unknown>,
) {
  await db.query(
    "insert into mining_events(profile,expedition,kind,occurred_at,details) values($1,$2,$3,$4,$5)",
    [profile, expedition, kind, new Date(now), details],
  );
}

async function saveBreak(
  db: PoolClient, profile: string, changed: Exclude<ExpeditionTransition, { error: unknown }>,
) {
  const { swing, expedition } = changed;
  if (!swing?.drop) return;
  const type = expedition.floor.rocks[swing.slot].type;
  const [old] = await rows<{ history: RockHistory }>(db,
    "select history from mining_rock_stats where profile=$1 and rock=$2", [profile, type]);
  await db.query(`
    insert into mining_rock_stats(profile,rock,history) values($1,$2,$3)
    on conflict(profile,rock) do update set history=excluded.history
  `, [profile, type, recordRockBreak(old?.history, swing.drop, swing.explosion)]);
}

async function saveDecision(
  db: PoolClient, profile: string, changed: Exclude<ExpeditionTransition, { error: unknown }>, now: number,
) {
  const { expedition, summary } = changed;
  if (!summary) {
    await one(db, `
      update mining_expeditions set state=$3, deepest_floor=$4
      where id=$1 and profile=$2 and status='active' returning id
    `, [expedition.id, profile, expedition, expedition.floor.number]);
    return;
  }

  // Closing the active row and crediting the bag must commit together.
  await one(db, `
    update mining_expeditions set status=$3, state=null, summary=$4, ended_at=$5
    where id=$1 and profile=$2 and status='active' returning id
  `, [expedition.id, profile, summary.outcome, summary, new Date(now)]);
  for (const [resource, quantity] of Object.entries(summary.secured)) {
    const { name } = miningResources[resource as keyof typeof miningResources];
    await db.query(`
      insert into public.crafters_inventory(profile_id,ore_id,ore_name,quantity) values($1,$2,$3,$4)
      on conflict(profile_id,ore_id) do update set quantity=crafters_inventory.quantity+excluded.quantity
    `, [profile, resource, name, quantity]);
  }
}

// The caller holds the player lock from identity() and records the request receipt
// in the same transaction as gameplay, analytics, and inventory changes.
export async function playMining(db: PoolClient, who: Identity, body: Record<string, unknown>) {
  const { profile } = who;
  const now = Date.now();
  const [row] = await rows<{ state: Expedition }>(db,
    "select state from mining_expeditions where profile=$1 and status='active'", [profile]);
  const active = row?.state;
  if (body.action === "start") {
    if (active) return loadMining(db, profile);
    const [last] = await rows<{ id: string }>(db, `
      select id from mining_expeditions where profile=$1 and ended_at is not null
      order by ended_at desc,id limit 1
    `, [profile]);
    if (body.previous !== (last?.id ?? null)) throw stale();
    const next = beginExpedition(randomUUID(), now, random);
    await db.query(`
      insert into mining_expeditions(id,profile,status,state,deepest_floor,started_at)
      values($1,$2,'active',$3,$4,$5)
    `, [next.id, profile, next, next.floor.number, new Date(now)]);
    await logEvent(db, profile, next.id, "start", now, { floor: next.floor.number, energyAfter: next.energy });
    return loadMining(db, profile);
  }

  if (body.action === "catalogue") {
    const rock = rockTypes.find(type => type.id === body.rock)?.id;
    if (!rock) throw new GameError("Unknown rock.");
    const [discovered] = await rows(db, "select 1 from mining_rock_stats where profile=$1 and rock=$2", [profile, rock]);
    if (discovered) await logEvent(db, profile, active?.id ?? null, "catalogue", now, {
      type: rock satisfies RockId, floor: active?.floor.number ?? null, energyBefore: active?.energy ?? null,
    });
    return {};
  }

  let decision: Decision;
  if (body.action === "swing") {
    if (typeof body.slot !== "number" || !Number.isInteger(body.slot) || body.slot < 0 || body.slot >= miningRules.rocksPerFloor)
      throw new GameError("Choose a rock.");
    decision = { action: "swing", slot: body.slot };
  } else if (body.action === "descend" || body.action === "return") {
    decision = { action: body.action };
  } else throw new GameError("Unknown mining action.");

  const id = uuid(body.expedition);
  if (!active || active.id !== id || active.revision !== body.revision) throw stale();
  const changed = makeDecision(active, decision, now, random);
  if ("error" in changed) throw new GameError(decisionErrors[changed.error], 409);
  await saveDecision(db, profile, changed, now);
  await saveBreak(db, profile, changed);
  await logEvent(db, profile, id, decision.action, now, changed.analytics);

  return { ...await loadMining(db, profile), swing: changed.swing };
}
