"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import type { CraftersInventory, CraftersProgress } from "../../lib/database.types";

import {resources,MAX_STAMINA,MINE_DURATION_MS,STAMINA_REFILL_MS,type ResourceNode,type MiningJob} from "../../lib/mentalist/resources";
import {post} from "../../lib/mentalist/client";

export default function CraftersPage({secure=false}:{secure?:boolean}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"map" | "inventory">("map");
  const [selectedResource, setSelectedResource] = useState<ResourceNode | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CraftersProgress | null>(null);
  const [inventory, setInventory] = useState<CraftersInventory[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Choose a resource site to mine.");

  useEffect(() => {
    if (secure) { setProfileId("session"); return; }
    const activeProfileId = sessionStorage.getItem("activeProfileId");
    if (!activeProfileId) {
      setLoading(false);
      setMessage("Choose a Mentalist player before crafting.");
      return;
    }
    setProfileId(activeProfileId);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profileId) return;
    loadCraftersState(profileId);
  }, [profileId]);

  useEffect(() => {
    if (!profileId || !progress?.mining_complete_at || saving) return;
    if (now < new Date(progress.mining_complete_at).getTime()) return;

    claimFinishedMining(profileId, progress);
  }, [profileId, progress, now, saving]);

  const staminaState = useMemo(() => {
    if (!progress) return { stamina: MAX_STAMINA, refillAt: null as number | null };
    return calculateStamina(progress, now);
  }, [progress, now]);

  const miningJob = useMemo<MiningJob | null>(() => {
    if (!progress?.mining_complete_at || !progress.active_mining_resource_name || !progress.active_mining_ore_id || !progress.active_mining_ore_name) {
      return null;
    }

    return {
      resourceName: progress.active_mining_resource_name,
      oreId: progress.active_mining_ore_id,
      oreName: progress.active_mining_ore_name,
      completeAt: new Date(progress.mining_complete_at).getTime(),
    };
  }, [progress]);

  const miningSecondsLeft = useMemo(() => {
    if (!miningJob) return 0;
    return Math.max(0, Math.ceil((miningJob.completeAt - now) / 1000));
  }, [miningJob, now]);

  const refillMinutesLeft = staminaState.refillAt
    ? Math.max(1, Math.ceil((staminaState.refillAt - now) / 60000))
    : null;

  async function savedCraft(action:string,node?:string) {
    setSaving(true);
    try {
      const result=await post<{progress:CraftersProgress;inventory:CraftersInventory[]}>({scope:"craft",action,node});
      setProgress(result.progress); setInventory(result.inventory);
      setMessage(result.progress.mining_complete_at?"Mining is underway.":"Choose a resource site to mine.");
      if(action==="mine")setSelectedResource(null);
      if(action==="collect")setActiveTab("inventory");
    } catch(error) {setMessage(error instanceof Error?error.message:"Could not save crafting.");}
    finally {setSaving(false);setLoading(false);}
  }
  async function loadCraftersState(activeProfileId: string) {
    if(secure)return savedCraft("craftState");
    if (!supabase) {
      setLoading(false);
      setMessage("Add Supabase env values before crafting.");
      return;
    }

    setLoading(true);
    try {
      const nextProgress = await loadOrCreateCraftersProgress(activeProfileId);
      const normalizedProgress = await persistCalculatedStamina(nextProgress, Date.now());
      const nextInventory = await loadCraftersInventory(activeProfileId);
      setProgress(normalizedProgress);
      setInventory(nextInventory);
      setMessage(normalizedProgress.mining_complete_at ? "Mining is underway." : "Choose a resource site to mine.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load Crafters.");
    } finally {
      setLoading(false);
    }
  }

  async function startMining() {
    if(secure){if(selectedResource && !saving)await savedCraft("mine",selectedResource.id);return;}
    if (!supabase || !profileId || !progress || !selectedResource || miningJob || saving) return;

    const currentStamina = calculateStamina(progress, Date.now());
    if (currentStamina.stamina < selectedResource.cost) return;

    setSaving(true);
    try {
      const nextStamina = currentStamina.stamina - selectedResource.cost;
      const nextRefilledAt = nextStamina >= MAX_STAMINA ? new Date().toISOString() : new Date(Date.now()).toISOString();
      const nextProgress = {
        ...progress,
        stamina: nextStamina,
        stamina_refilled_at: nextRefilledAt,
        active_mining_resource_id: selectedResource.id,
        active_mining_resource_name: selectedResource.name,
        active_mining_ore_id: selectedResource.oreId,
        active_mining_ore_name: selectedResource.oreName,
        mining_complete_at: new Date(Date.now() + MINE_DURATION_MS).toISOString(),
      };

      const { data, error } = await supabase
        .from("crafters_progress")
        .update({
          stamina: nextProgress.stamina,
          stamina_refilled_at: nextProgress.stamina_refilled_at,
          active_mining_resource_id: nextProgress.active_mining_resource_id,
          active_mining_resource_name: nextProgress.active_mining_resource_name,
          active_mining_ore_id: nextProgress.active_mining_ore_id,
          active_mining_ore_name: nextProgress.active_mining_ore_name,
          mining_complete_at: nextProgress.mining_complete_at,
        })
        .eq("profile_id", profileId)
        .select()
        .single();

      if (error) throw error;
      setProgress(data);
      setMessage(`Mining ${selectedResource.name}. Check back in 10s.`);
      setSelectedResource(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start mining.");
    } finally {
      setSaving(false);
    }
  }

  async function claimFinishedMining(activeProfileId: string, currentProgress: CraftersProgress) {
    if (!supabase || !currentProgress.active_mining_ore_id || !currentProgress.active_mining_ore_name) return;

    setSaving(true);
    try {
      await grantOre(activeProfileId, currentProgress.active_mining_ore_id, currentProgress.active_mining_ore_name, 1);
      const { data, error } = await supabase
        .from("crafters_progress")
        .update({
          active_mining_resource_id: null,
          active_mining_resource_name: null,
          active_mining_ore_id: null,
          active_mining_ore_name: null,
          mining_complete_at: null,
        })
        .eq("profile_id", activeProfileId)
        .select()
        .single();

      if (error) throw error;
      setProgress(await persistCalculatedStamina(data, Date.now()));
      setInventory(await loadCraftersInventory(activeProfileId));
      setMessage(`${currentProgress.active_mining_resource_name} produced 1 ${currentProgress.active_mining_ore_name}.`);
      setActiveTab("inventory");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not claim mined ore.");
    } finally {
      setSaving(false);
    }
  }

  const inventoryRows = [...inventory].sort((oreA, oreB) => oreA.ore_name.localeCompare(oreB.ore_name));
  const stamina = staminaState.stamina;

  return (
    <main className="shell crafters-shell">
      <header className="topbar">
        <div className="player-header">
          <Link className="mode-back-link" href="/">Modes</Link>
          <strong>Crafters</strong>
          <div className="resource inline-coins">Stamina <span>{stamina} / {MAX_STAMINA}</span></div>
        </div>
      </header>

      <div className="status-line">
        {miningJob
          ? `Mining: ${miningJob.resourceName} (${miningSecondsLeft}s)`
          : stamina < MAX_STAMINA && refillMinutesLeft
            ? `${message} +1 stamina in ${refillMinutesLeft}m.`
            : message}
      </div>

      <section className="crafters-content">
        {activeTab === "map" ? (
          <div className="crafter-map-window" aria-label="Crafters resource map">
            <div className="crafter-map-world">
              <div className="crafter-map-label">Northern Quarry</div>
              {resources.map((resource) => (
                <button
                  className="resource-node"
                  key={resource.id}
                  onClick={() => setSelectedResource(resource)}
                  style={{ left: `${resource.x}%`, top: `${resource.y}%` }}
                  type="button"
                  disabled={loading || (!secure && !isSupabaseConfigured) || !profileId}
                >
                  <span>{resource.name}</span>
                  <small>{resource.oreName}</small>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="crafter-inventory">
            <div className="section-heading">
              <h2>Inventory <span>ORES</span></h2>
            </div>
            {inventoryRows.length > 0 ? (
              <div className="ore-list">
                {inventoryRows.map((ore) => (
                  <div className="ore-row" key={ore.ore_id}>
                    <span>{ore.ore_name}</span>
                    <strong>{ore.quantity}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-inventory">Mine a resource to find your first ore.</div>
            )}
          </div>
        )}
      </section>

      <nav className="tabs crafters-tabs" aria-label="Crafters sections">
        <button className={activeTab === "map" ? "active" : ""} onClick={() => setActiveTab("map")} type="button">
          Map
        </button>
        <button className={activeTab === "inventory" ? "active" : ""} onClick={() => setActiveTab("inventory")} type="button">
          Inventory
        </button>
      </nav>

      {selectedResource && (
        <div className="signin-overlay" role="dialog" aria-modal="true" aria-labelledby="mine-title">
          <div className="signin-card mine-modal">
            <h1 id="mine-title">{selectedResource.name}</h1>
            <p>Mine this site for {selectedResource.oreName}. Costs {selectedResource.cost} stamina and takes 10s.</p>
            <button disabled={saving || Boolean(miningJob) || stamina < selectedResource.cost} onClick={startMining} type="button">
              {saving ? "SAVING" : miningJob ? "MINING" : stamina < selectedResource.cost ? "LOW STAMINA" : "MINE"}
            </button>
            <button className="secondary-button" onClick={() => setSelectedResource(null)} type="button">CLOSE</button>
          </div>
        </div>
      )}
    </main>
  );
}

function calculateStamina(progress: CraftersProgress, timestamp: number) {
  if (progress.stamina >= MAX_STAMINA) {
    return { stamina: MAX_STAMINA, refillAt: null as number | null, refilledAt: new Date(timestamp).toISOString() };
  }

  const anchor = new Date(progress.stamina_refilled_at).getTime();
  const gained = Math.max(0, Math.floor((timestamp - anchor) / STAMINA_REFILL_MS));
  const stamina = Math.min(MAX_STAMINA, progress.stamina + gained);
  if (stamina >= MAX_STAMINA) {
    return { stamina, refillAt: null as number | null, refilledAt: new Date(timestamp).toISOString() };
  }

  const refilledAt = new Date(anchor + gained * STAMINA_REFILL_MS).toISOString();
  return { stamina, refillAt: new Date(refilledAt).getTime() + STAMINA_REFILL_MS, refilledAt };
}

async function loadOrCreateCraftersProgress(profileId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: existing, error: lookupError } = await supabase
    .from("crafters_progress")
    .select()
    .eq("profile_id", profileId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("crafters_progress")
    .insert({ profile_id: profileId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function persistCalculatedStamina(progress: CraftersProgress, timestamp: number) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const next = calculateStamina(progress, timestamp);
  if (next.stamina === progress.stamina && next.refilledAt === progress.stamina_refilled_at) return progress;

  const { data, error } = await supabase
    .from("crafters_progress")
    .update({ stamina: next.stamina, stamina_refilled_at: next.refilledAt })
    .eq("profile_id", progress.profile_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function loadCraftersInventory(profileId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("crafters_inventory")
    .select()
    .eq("profile_id", profileId)
    .order("ore_name");

  if (error) throw error;
  return data ?? [];
}

async function grantOre(profileId: string, oreId: string, oreName: string, amount: number) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: existing, error: lookupError } = await supabase
    .from("crafters_inventory")
    .select("quantity")
    .eq("profile_id", profileId)
    .eq("ore_id", oreId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const { error } = await supabase.from("crafters_inventory").upsert(
    {
      profile_id: profileId,
      ore_id: oreId,
      ore_name: oreName,
      quantity: (existing?.quantity ?? 0) + amount,
    },
    { onConflict: "profile_id,ore_id" },
  );

  if (error) throw error;
}
