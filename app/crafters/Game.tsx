"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { post, RequestError } from "../../lib/mentalist/client";
import {
  ENERGY_REFILL_MS, MAX_ENERGY, MINE_DURATION_MS, energyAt, miningCost, pickaxes, resources, swords,
  type CraftState,
} from "../../lib/mentalist/resources";
import type { View } from "./Screen";

type Action = "mine" | "collect" | "craftTool" | "equipPickaxe" | "craftState";
type Command = { action: Action; node?: string; tool?: string; id?: string };

export default function Game({ view, initial }: { view: View; initial: CraftState }) {
  const [state, setState] = useState(initial);
  const [now, setNow] = useState(initial.serverNow);
  const [status, setStatus] = useState(initial.collectedOre ? `Mined 1 ${initial.collectedOre}.` : "");
  const [error, setError] = useState<{ message: string; retry: Command } | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const autoCollected = useRef<number | null>(null);
  const { inventory, equipment, job, serverNow } = state;
  const pickaxe = pickaxes.find((item) => item.id === equipment.equippedPickaxe);
  const energy = energyAt(state.energy, state.refilledAt, now);
  const refillSeconds = Math.max(0, Math.ceil((energy.refilledAt + ENERGY_REFILL_MS - now) / 1000));
  const left = job ? Math.max(0, job.completeAt - now) : 0;

  useEffect(() => {
    const started = performance.now();
    setNow(serverNow);
    const timer = window.setInterval(() => setNow(serverNow + performance.now() - started), job ? 125 : 1000);
    return () => window.clearInterval(timer);
  }, [serverNow, job]);

  useEffect(() => {
    if (!job || left > 0 || busy || autoCollected.current === job.completeAt) return;
    autoCollected.current = job.completeAt;
    void send({ action: "collect" });
  }, [job, left, busy]);

  async function send(command: Command) {
    if (pending.current) return;
    pending.current = true;
    setError(null);
    setStatus("");
    setBusy(true);
    try {
      const next = await post<CraftState>({ scope: "craft", ...command });
      setState(next);
      const tool = [...pickaxes, ...swords].find((item) => item.id === command.tool);
      if (next.collectedOre) setStatus(`Mined 1 ${next.collectedOre}.`);
      else if (command.action === "craftTool" && tool) setStatus(`Crafted ${tool.name}.`);
      else if (command.action === "equipPickaxe") setStatus(tool ? `Equipped ${tool.name}.` : "Pickaxe unequipped.");
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) {
        window.location.replace(view === "crafting" ? "/crafters/sign-in?next=crafting" : "/crafters/sign-in");
        return;
      }
      setError({
        message: error instanceof Error ? error.message : "Could not save your progress.",
        retry: error instanceof RequestError && error.status < 500 ? { action: "craftState" } : command,
      });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function mine(node: string) {
    void send({ action: "mine", node, id: crypto.randomUUID() });
  }

  function useTool(action: "craftTool" | "equipPickaxe", tool: string) {
    void send({ action, tool, id: crypto.randomUUID() });
  }

  return (
    <main className="cf-shell">
      <header className="cf-header">
        <div>
          <Link href="/">Game modes</Link>
          <h1>Crafters</h1>
        </div>
        <div className="cf-energy">
          <div><strong>Energy</strong><span>{energy.energy} / {MAX_ENERGY}</span></div>
          <progress aria-label="Energy" value={energy.energy} max={MAX_ENERGY} />
          <small>{energy.energy === MAX_ENERGY
            ? "Energy full"
            : `+1 in ${Math.floor(refillSeconds / 60)}:${String(refillSeconds % 60).padStart(2, "0")}`}</small>
        </div>
      </header>

      <nav className="cf-nav" aria-label="Crafters sections">
        <Link href="/crafters" prefetch={false} aria-current={view === "mining" ? "page" : undefined}>Mining</Link>
        <Link href="/crafters/crafting" prefetch={false} aria-current={view === "crafting" ? "page" : undefined}>Crafting</Link>
      </nav>

      <div className="cf-notice">
        <p role="status">{status || (job ? `Mining ${job.oreName}…` : "")}</p>
        {error && <div role="alert">{error.message} <button disabled={busy} onClick={() => void send(error.retry)}>
          {error.retry.action === "craftState" ? "Refresh" : "Retry"}
        </button></div>}
      </div>

      {view === "mining" ? (
        <section aria-labelledby="mine-title" className="cf-card">
          <div className="cf-section-heading">
            <div>
              <h2 id="mine-title">Mine ore</h2>
              <p>{pickaxe ? `${pickaxe.name} equipped` : "Basic mining"}</p>
            </div>
            <span>1 ore per 10s</span>
          </div>
          <ul className="cf-list">
            {resources.map((node) => {
              const active = node.id === job?.node;
              const finished = active && left === 0;
              const required = pickaxes.find((item) => item.tier === node.tier);
              const locked = node.tier > (pickaxe?.tier ?? 0);
              const cost = miningCost(node, pickaxe);
              return (
                <li key={node.id} className={active ? "cf-active" : undefined}>
                  <img className="cf-sprite" src={`/crafters/${node.oreId}.png`} alt="" width={48} height={48} />
                  <div className="cf-item">
                    <h3>{node.oreName}</h3>
                    <progress
                      aria-label={`${node.oreName} mining progress`}
                      value={active ? MINE_DURATION_MS - Math.min(left, MINE_DURATION_MS) : 0}
                      max={MINE_DURATION_MS}
                    />
                    <small>
                      {inventory[node.oreId] ?? 0} owned · {locked ? `Requires ${required?.name}` : `${cost} energy`}
                    </small>
                  </div>
                  {active ? (
                    finished ? <button disabled={busy} onClick={() => void send({ action: "collect" })}>Collect</button>
                      : <span className="cf-countdown">{Math.ceil(left / 1000)}s</span>
                  ) : (
                    <button type="button" disabled={busy || !!job || locked || energy.energy < cost}
                      aria-label={`Mine ${node.oreName}`} onClick={() => mine(node.id)}>
                      {locked ? "Locked" : "Mine"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <>
          <section className="cf-card" aria-labelledby="materials-title">
            <div className="cf-section-heading"><h2 id="materials-title">Materials</h2></div>
            <ul className="cf-materials">
              {resources.map((node) => (
                <li key={node.oreId}>
                  <img className="cf-sprite" src={`/crafters/${node.oreId}.png`} alt="" width={28} height={28} />
                  {node.oreName} <strong>{inventory[node.oreId] ?? 0}</strong>
                </li>
              ))}
            </ul>
          </section>
          <div className="cf-recipes">
            {[
              { heading: "Pickaxes", slot: "pickaxe", recipes: pickaxes },
              { heading: "Swords", slot: "sword", recipes: swords },
            ].map(({ heading, slot, recipes }) => (
              <section className="cf-card" key={slot} aria-labelledby={`recipes-${slot}`}>
                <div className="cf-section-heading">
                  <div>
                    <h2 id={`recipes-${slot}`}>{heading}</h2>
                    {slot === "sword" && <Link href="/7math?tab=inventory" prefetch={false}>Equip in 7math inventory</Link>}
                  </div>
                </div>
                <ul className="cf-list cf-tool-list">
                  {recipes.map((tool) => {
                    const owned = equipment.ownedTools.includes(tool.id);
                    const equipped = tool.id === (tool.slot === "pickaxe" ? equipment.equippedPickaxe : equipment.equippedSword);
                    const ingredients = Object.entries(tool.ingredients);
                    const canCraft = ingredients.every(([ore, count]) => (inventory[ore] ?? 0) >= count);
                    const unlocked = tool.slot === "pickaxe"
                      ? resources.filter((node) => node.tier === tool.tier).map((node) => node.oreName)
                      : [];
                    return (
                      <li key={tool.id}>
                        <img className="cf-sprite" src={`/crafters/${tool.slot}.png`} alt="" width={40} height={40} />
                        <div className="cf-item">
                          <h3>{tool.name}</h3>
                          <small>{tool.slot === "pickaxe"
                            ? `Energy cost −${tool.discount} (minimum 1)`
                            : `+${tool.damage} damage per correct answer`}</small>
                          {unlocked.length > 0 && <small>Unlocks {unlocked.join(", ")}</small>}
                          {!owned && <small className="cf-ingredients">
                            {ingredients.map(([ore, count]) => (
                              <span key={ore}>{inventory[ore] ?? 0}/{count} {resources.find((node) => node.oreId === ore)?.oreName}</span>
                            ))}
                          </small>}
                        </div>
                        {owned ? (
                          tool.slot === "pickaxe" ? (
                            <button disabled={busy} aria-label={`${equipped ? "Unequip" : "Equip"} ${tool.name}`}
                              onClick={() => useTool("equipPickaxe", equipped ? "" : tool.id)}>
                              {equipped ? "Unequip" : "Equip"}
                            </button>
                          ) : <span className="cf-owned">{equipped ? "Equipped" : "Crafted"}</span>
                        ) : (
                          <button disabled={busy || !canCraft} aria-label={`Craft ${tool.name}`}
                            onClick={() => useTool("craftTool", tool.id)}>Craft</button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
