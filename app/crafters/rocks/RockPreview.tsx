"use client";

import Link from "next/link";
import { useState } from "react";
import { miningResources, miningRules, resourceIds } from "../../../lib/crafters/config";
import {
  canDescend, makeDecision, publicExpedition,
  type Decision, type Expedition, type ExpeditionSummary, type SwingResult,
} from "../../../lib/crafters/expedition";
import { atlas, rockAppearance, rockFrame, type RockAppearance, type RockFrame } from "../../../lib/crafters/rock-art";
import RockCatalogue from "./RockCatalogue";
import { ResourceSprite, RockSprite, TerrainSprite } from "./RockSprite";
import { openingPreviewFloor, startPreview } from "./sandbox";

type SlotHit = SwingResult & { swingNumber: number };
type Scene = {
  expedition: Expedition;
  hits: Partial<Record<number, SlotHit>>;
  summary: ExpeditionSummary | null;
  message: string;
};

function MiningSlot({ slot, appearance, frame, hit, stairs, canEnter, finished, onDecision }: {
  slot: number; appearance: RockAppearance; frame: RockFrame; hit?: SlotHit;
  stairs: boolean; canEnter: boolean; finished: boolean; onDecision: (decision: Decision) => void;
}) {
  const broken = frame === 4;
  const enabled = !finished && (stairs ? canEnter : !broken);
  const label = stairs ? (canEnter ? "Descend the staircase" : finished ? "Staircase" : "Staircase, low energy")
    : broken ? `Rock ${slot + 1}, ${hit?.explosion ? "explosion aftermath" : "cleared"}`
      : `Rock ${slot + 1}, ${atlas.frames[frame].toLowerCase()}`;

  return (
    <button type="button" className="rock-slot" aria-label={label} aria-disabled={!enabled}
      data-state={stairs ? "stairs" : broken ? "cleared" : "rock"}
      onClick={() => enabled && onDecision(stairs ? { action: "descend" } : { action: "swing", slot })}>
      <span className="rock-stack" key={hit?.swingNumber ?? 0} aria-hidden="true">
        {!broken && <RockSprite appearance={appearance} frame={frame} className={hit ? "rock-hit" : undefined} />}
        {broken && (!stairs || hit?.explosion) && <TerrainSprite terrain={hit?.explosion ? "explosion" : "empty"} className="rock-ground-reveal" />}
        {broken && stairs && <TerrainSprite terrain="stairs" className="rock-stair-reveal" />}
        {broken && <RockSprite appearance={appearance} frame={4} className="rock-rubble" />}
        {hit?.broken && (
          <span className={`rock-chips${hit.explosion ? " rock-embers" : ""}`}>
            <i /><i /><i /><i /><i />
          </span>
        )}
        {hit?.drop && <ResourceSprite resource={hit.drop.resource} className="rock-drop" />}
        {!broken && appearance.family === "crystal" && <i className="rock-twinkle" />}
      </span>
    </button>
  );
}

function describeSwing(swing: SwingResult) {
  if (!swing.drop) return `Rock ${swing.slot + 1} cracked.`;
  const parts = [`Found ${swing.drop.quantity} ${miningResources[swing.drop.resource].name.toLowerCase()}.`];
  if (swing.explosion) parts.push(`Explosion cost ${miningRules.explosionCost} energy.`);
  if (swing.stairs) parts.push("Staircase discovered.");
  return parts.join(" ");
}

function startScene(id: string, now: number): Scene {
  return { expedition: startPreview(id, now), hits: {}, summary: null, message: "" };
}

export default function RockPreview({ seed, startedAt, initialView }: {
  seed: string; startedAt: number; initialView: "mine" | "catalogue";
}) {
  const [scene, setScene] = useState(() => startScene(seed, startedAt));
  const [view, setView] = useState(initialView);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const { expedition, summary, hits, message } = scene;
  const active = publicExpedition(expedition);
  const canEnter = !summary && canDescend(active.energy, active.stairSlot !== null);

  function play(decision: Decision) {
    if (summary) return;
    const next = makeDecision(expedition, decision, Date.now(), Math.random);
    if ("error" in next) return;
    let nextHits = hits;
    let nextMessage = "";
    if (decision.action === "descend") {
      nextHits = {};
      nextMessage = `Entered floor ${next.expedition.floor.number}.`;
    }
    if (next.swing) {
      nextHits = { ...hits, [next.swing.slot]: { ...next.swing, swingNumber: next.expedition.swings } };
      nextMessage = describeSwing(next.swing);
    }
    if (next.summary) {
      const ending = next.summary.outcome === "returned" ? "Returned to the surface." : "Out of energy. The expedition ended.";
      nextMessage = [nextMessage, ending].filter(Boolean).join(" ");
    }
    setScene({ expedition: next.expedition, hits: nextHits, summary: next.summary, message: nextMessage });
  }

  return (
    <main className="rock-preview" data-theme={theme}>
      <div className="rock-shell">
        <header className="rock-header">
          <Link className="rock-back" href="/crafters"><span aria-hidden="true">‹</span> Crafters</Link>
          <div className="rock-segment" role="group" aria-label="Background">
            <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Dark</button>
            <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Light</button>
          </div>
        </header>
        <div className="rock-intro">
          <h1>Mining preview</h1>
          <div className="rock-segment rock-views" role="group" aria-label="Mining preview views">
            <button type="button" aria-pressed={view === "mine"} onClick={() => setView("mine")}>Mine</button>
            <button type="button" aria-pressed={view === "catalogue"} onClick={() => setView("catalogue")}>Rock catalogue</button>
          </div>
        </div>
        {view === "catalogue" ? <RockCatalogue /> : (
          <div className="rock-layout">
            <section className="rock-panel rock-play" aria-labelledby="rock-floor-title">
              <div className="rock-play-heading">
                <h2 id="rock-floor-title">Floor {active.floor}</h2>
                <div className="rock-energy">
                  <div><label htmlFor="rock-energy-meter">Energy</label><span>{active.energy} / {active.maxEnergy}</span></div>
                  <progress id="rock-energy-meter" value={active.energy} max={active.maxEnergy} />
                </div>
              </div>
              <div className="rock-board" key={`${active.id}:${active.floor}`}>
                {active.rocks.map((rock, slot) => (
                  <MiningSlot key={slot} slot={slot} frame={rockFrame(rock)}
                    appearance={active.floor === openingPreviewFloor && (slot === 0 || slot === 4)
                      ? rockAppearance(rock.type, active.id, active.floor, slot, expedition.floor.rocks[slot].hazardHint,
                        slot === 0 ? "granite" : "crystal-shell")
                      : rock.appearance}
                    hit={hits[slot]} stairs={active.stairSlot === slot} canEnter={canEnter}
                    finished={!!summary} onDecision={play} />
                ))}
              </div>
              <div className="rock-play-footer">
                <p className="rock-message" role="status">{message || "Tap a rock to mine it. One rock hides a staircase."}</p>
                {summary
                  ? <button type="button" className="rock-action" onClick={() => setScene(startScene(crypto.randomUUID(), Date.now()))}>Restart preview</button>
                  : <button type="button" className="rock-action" onClick={() => play({ action: "return" })}>Return to surface</button>}
              </div>
            </section>
            <aside className="rock-panel rock-finds" aria-labelledby="rock-finds-title">
              <h2 id="rock-finds-title">Expedition finds</h2>
              <ul>
                {resourceIds.map((resource) => {
                  const quantity = (summary?.secured ?? active.collected)[resource] ?? 0;
                  return (
                    <li key={resource} data-filled={quantity > 0}>
                      <ResourceSprite resource={resource} />
                      <span>{miningResources[resource].name}</span><strong>{quantity}</strong>
                    </li>
                  );
                })}
              </ul>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
