"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { post, RequestError } from "../../lib/mentalist/client";
import { miningResources, miningRules, resourceIds, rockType, type RockId } from "../../lib/crafters/config";
import { canDescend, type ExpeditionSummary, type MiningView, type SwingResult } from "../../lib/crafters/expedition";
import { Catalogue, ResourceIcon, RockArt } from "./MiningParts";
import { atlas, rockAppearance, rockFrame } from "../../lib/crafters/rock-art";
import { TerrainSprite } from "./rocks/RockSprite";
import { miningSound, unlockMiningSound } from "./sound";

type Command = { action: "start"; id: string; previous: string | null }
  | { action: "swing"; id: string; expedition: string; revision: number; slot: number }
  | { action: "descend" | "return"; id: string; expedition: string; revision: number }
  | { action: "miningState" };
type Point = { x: number; y: number };
type Effect = { id: string; from: Point; to: Point; hit: SwingResult };
const fragments = [
  [-39, -27, -95], [-25, -44, 35], [-4, -50, 110], [18, -45, -70],
  [37, -24, 85], [43, 3, 160], [26, 24, -45], [-33, 19, 45],
];

function center(element: Element): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Summary({ summary, start, close, blocked }: {
  summary: ExpeditionSummary; start: () => void; close: () => void; blocked: boolean;
}) {
  const rows = resourceIds.filter(id => summary.collected[id]);
  return (
    <section className="mine-panel mine-summary" aria-labelledby="mine-summary-title">
      <div className="mine-summary-heading">
        <h2 id="mine-summary-title">{summary.outcome === "returned" ? "Back at camp" : "You passed out"}</h2>
        <p>{summary.outcome === "returned" ? "Your haul is secured." : "You secured half of each resource, rounded down."}</p>
      </div>
      <dl className="mine-stat-grid">
        <div><dt>Deepest floor</dt><dd>{summary.deepestFloor}</dd></div>
        <div><dt>Rocks mined</dt><dd>{summary.rocksMined}</dd></div>
        <div><dt>Swings</dt><dd>{summary.swings}</dd></div>
        <div><dt>Explosions</dt><dd>{summary.hazards}</dd></div>
        <div><dt>Duration</dt><dd>{formatDuration(summary.durationMs)}</dd></div>
      </dl>
      {rows.length ? <table className="mine-haul">
        <thead><tr><th scope="col">Resource</th><th scope="col">Collected</th><th scope="col">Lost</th><th scope="col">Secured</th></tr></thead>
        <tbody>{rows.map(id => <tr key={id}>
          <th scope="row"><span><ResourceIcon id={id} />{miningResources[id].name}</span></th>
          <td>{summary.collected[id]}</td><td>{summary.lost[id] ?? 0}</td><td>{summary.secured[id] ?? 0}</td>
        </tr>)}</tbody>
      </table> : <p className="mine-muted">No resources collected.</p>}
      <div className="mine-actions">
        <button type="button" className="mine-button mine-secondary" onClick={close}>Camp</button>
        <button type="button" className="mine-button mine-primary" aria-disabled={blocked} onClick={start}>New Expedition</button>
      </div>
    </section>
  );
}

function Effects({ effects }: { effects: Effect[] }) {
  return <div className="mine-fx-layer" aria-hidden="true">
    {effects.map(({ id, from, to, hit }) => <div
      key={id}
      className="mine-fx-anchor"
      style={{ left: from.x, top: from.y, "--flight-x": `${to.x - from.x}px`, "--flight-y": `${to.y - from.y}px` } as CSSProperties}
    >
      {fragments.map(([x, y, spin], index) => <i
        key={index} className="mine-fragment"
        style={{ "--fragment-x": `${x}px`, "--fragment-y": `${y}px`, "--fragment-spin": `${spin}deg` } as CSSProperties}
      />)}
      {hit.drop && <span className="mine-fly">
        <ResourceIcon id={hit.drop.resource} /><b>+{hit.drop.quantity}</b>
      </span>}
      {hit.drop?.resource === "gem" && <span className="mine-gem-flare" />}
      {hit.explosion && <><span className="mine-blast" /><b className="mine-blast-loss">−{miningRules.explosionCost} energy</b></>}
      {hit.stairs && <span className="mine-stair-flare" />}
    </div>)}
  </div>;
}

function animateHit(target: Element) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  target.animate?.([
    { transform: "translate(0)" }, { transform: "translate(-3px, 2px) rotate(-3deg)" },
    { transform: "translate(3px, -1px) rotate(2deg)" }, { transform: "translate(0)" },
  ], { duration: 155 });
}

export default function Game({ initial }: { initial: MiningView }) {
  const [state, setState] = useState(initial);
  const [showSummary, setShowSummary] = useState(false);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; retry: Command } | null>(null);
  const [status, setStatus] = useState("");
  const [effects, setEffects] = useState<Effect[]>([]);
  const pending = useRef(false);
  const bag = useRef<HTMLUListElement>(null);
  const shell = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedbackTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { active, latest, catalogue, inventory, stats } = state;
  const blocked = busy || failure !== null;

  useEffect(() => {
    try { setMuted(localStorage.getItem("crafters:muted") === "1"); } catch { /* Optional preference. */ }
    const timers = feedbackTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  function sound() {
    if (!muted) unlockMiningSound();
  }

  function toggleSound() {
    if (muted) unlockMiningSound();
    try { localStorage.setItem("crafters:muted", muted ? "0" : "1"); } catch { /* Optional preference. */ }
    setMuted(!muted);
  }

  function showFeedback(id: string, result: SwingResult, from?: Point) {
    const drop = result.drop;
    if (!result.broken || !drop) {
      const rock = active?.rocks[result.slot];
      const stage = rock && rockFrame({ ...rock, remaining: result.remaining });
      setStatus(stage ? `Rock ${result.slot + 1} is ${atlas.frames[stage].toLowerCase()}.` : "The rock cracked.");
      return;
    }
    const messages = [`+${drop.quantity} ${miningResources[drop.resource].name}`];
    if (result.stairs) messages.push("Staircase found");
    if (result.explosion) messages.push(`Explosion −${miningRules.explosionCost} energy`);
    setStatus(messages.join(" · "));
    if (!muted) {
      miningSound(result.explosion ? "explosion" : "break");
      if (result.stairs) miningSound("stairs");
      if (drop.resource === "gem") miningSound("gem");
    }
    if (result.explosion) {
      if (shell.current) animateHit(shell.current);
      navigator.vibrate?.([30, 25, 45]);
    } else navigator.vibrate?.(drop.resource === "gem" || result.stairs ? [18, 22, 25] : 12);

    if (!from) return;
    const target = bag.current?.querySelector(`[data-resource="${drop.resource}"]`);
    setEffects(current => [...current, { id, from, to: target ? center(target) : from, hit: result }]);
    const timer = setTimeout(() => {
      const index = feedbackTimers.current.indexOf(timer);
      if (index >= 0) feedbackTimers.current.splice(index, 1);
      setEffects(current => current.filter(effect => effect.id !== id));
    }, 850);
    feedbackTimers.current.push(timer);
  }

  async function send(command: Command, from?: Point) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const next = await post<MiningView>({ scope: "mining", ...command });
      if (command.action === "swing" && next.swing) showFeedback(command.id, next.swing, from);
      if (command.action === "descend" && next.active) {
        if (!muted) miningSound("descend");
        setStatus(`Floor ${next.active.floor}`);
      }
      if (command.action === "start") {
        setStatus("");
        setShowSummary(false);
      } else if (active && !next.active) {
        setShowSummary(Boolean(next.latest));
      }
      setState(next);
      if (Boolean(active) !== Boolean(next.active)) requestAnimationFrame(() => heading.current?.focus());
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) {
        window.location.replace("/crafters/sign-in");
        return;
      }
      setFailure({
        message: error instanceof RequestError ? error.message : "Connection interrupted.",
        retry: error instanceof RequestError && error.status < 500 ? { action: "miningState" } : command,
      });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function start() {
    if (blocked || pending.current) return;
    sound();
    void send({ action: "start", id: crypto.randomUUID(), previous: latest?.id ?? null });
  }

  function play(action: "descend" | "return" | "swing", slot?: number, target?: HTMLButtonElement) {
    if (blocked || pending.current || !active) return;
    sound();
    const context = { id: crypto.randomUUID(), expedition: active.id, revision: active.revision };
    if (action === "swing") {
      if (slot === undefined || !target || !active.rocks[slot]?.remaining) return;
      animateHit(target);
      if (!muted) miningSound("hit");
      navigator.vibrate?.(10);
      void send({ action, slot, ...context }, center(target));
    } else void send({ action, ...context });
  }

  function recordCatalogueView(rock: RockId) {
    const command = { scope: "mining", action: "catalogue", rock, id: crypto.randomUUID() };
    void post(command).catch(error => {
      if (!(error instanceof RequestError) || error.status >= 500) void post(command).catch(() => {});
    });
  }

  const canGoDeeper = active ? canDescend(active.energy, active.stairSlot !== null) : false;
  return (
    <main ref={shell} className="cf-shell mine-shell">
      <div className="mine-content">
        <header className="mine-top">
          <div className="mine-brand"><Link href="/">Game modes</Link><h1 ref={heading} tabIndex={-1}>Crafters</h1></div>
          <div className="mine-top-actions">
            <button type="button" className="mine-button mine-secondary" onClick={toggleSound} aria-pressed={!muted}>Sound {muted ? "off" : "on"}</button>
            <button type="button" className="mine-button mine-secondary" onClick={() => setCatalogueOpen(true)}>Rock Catalogue</button>
          </div>
        </header>

        {failure && <div className="mine-error" role="alert">
          <span>{failure.message}</span>
          <button type="button" className="mine-button mine-secondary" disabled={busy} onClick={() => void send(failure.retry)}>
            {failure.retry.action === "miningState" ? "Refresh" : "Retry"}
          </button>
        </div>}

        {active ? (
          <div className="mine-layout">
            <section className="mine-arena" aria-labelledby="mine-floor">
              <header className="mine-hud">
                <h2 id="mine-floor">Floor {active.floor}</h2>
                <div className="mine-energy">
                  <div><span>Energy</span><strong>{active.energy} / {active.maxEnergy}</strong></div>
                  <div className="mine-energy-track" role="progressbar" aria-label="Energy" aria-valuenow={active.energy} aria-valuemin={0} aria-valuemax={active.maxEnergy}>
                    <span style={{ width: `${active.energy / active.maxEnergy * 100}%` }} data-low={active.energy <= active.maxEnergy * 0.2} />
                  </div>
                </div>
              </header>
              <div className="mine-grid" key={`${active.id}:${active.floor}`} aria-label="Mining rocks">
                {active.rocks.map((rock, slot) => {
                  const appearance = rock.appearance ?? rockAppearance(rock.type, active.id, active.floor, slot);
                  const frame = rockFrame(rock);
                  if (frame === 4) {
                    const lastHit = state.swing?.floor === active.floor && state.swing.slot === slot ? state.swing : null;
                    const justBroke = lastHit?.broken || effects.some(({ hit }) => hit.floor === active.floor && hit.slot === slot);
                    const crater = rock.exploded || lastHit?.explosion;
                    const stairs = active.stairSlot === slot;
                    return (
                      <div key={slot} className="mine-cell mine-cleared">
                        <span className="mine-reveal" role="img" aria-label={stairs ? "Staircase discovered" : crater ? "Explosion aftermath" : "Cleared rock"}>
                          {(!stairs || crater) && <TerrainSprite terrain={crater ? "explosion" : "empty"} />}
                          {stairs && <TerrainSprite terrain="stairs" className="mine-staircase" />}
                          {justBroke && <span className="mine-rubble-reveal"><RockArt type={rock.type} appearance={appearance} frame={4} /></span>}
                        </span>
                      </div>
                    );
                  }
                  const visibleName = appearance.family === "false-glint" ? rockType("copper-flecked").name
                    : appearance.family === "crystal-shell" ? rockType("crystalline").name
                      : appearance.family === "shiny-surface" ? "Glossy rock" : rockType(rock.type).name;
                  return <button
                    type="button" key={slot} className="mine-cell mine-rock" aria-disabled={blocked}
                    aria-label={`${visibleName}, ${rock.remaining} of ${rock.durability} swings left`}
                    aria-description={atlas.frames[frame]}
                    onClick={event => play("swing", slot, event.currentTarget)}
                  >
                    <RockArt type={rock.type} appearance={appearance} frame={frame} animate />
                    <span className="mine-durability" aria-hidden="true">
                      {Array.from({ length: rock.durability }, (_, pip) => <i key={pip} data-filled={pip < rock.remaining} />)}
                    </span>
                  </button>;
                })}
              </div>
              <p className="mine-status" role="status">{status}</p>
              <div className="mine-actions mine-exit">
                <button type="button" className="mine-button mine-secondary" aria-disabled={blocked} onClick={() => play("return")}>Return Home</button>
                <button type="button" className="mine-button mine-primary" disabled={!canGoDeeper} aria-disabled={blocked || !canGoDeeper}
                  onClick={() => play("descend")}>Descend <small>−{miningRules.descentCost} energy</small></button>
              </div>
            </section>
            <section className="mine-panel mine-bag" aria-labelledby="mine-bag-title">
              <h2 id="mine-bag-title">This Expedition</h2>
              <ul ref={bag} className="mine-resources">
                {resourceIds.map(id => <li key={id} data-resource={id}>
                  <ResourceIcon id={id} /><span>{miningResources[id].name}</span><strong>{active.collected[id] ?? 0}</strong>
                </li>)}
              </ul>
            </section>
          </div>
        ) : showSummary && latest ? (
          <Summary summary={latest} start={start} close={() => setShowSummary(false)} blocked={blocked} />
        ) : (
          <div className="mine-camp">
            <section className="mine-camp-banner" aria-labelledby="mine-camp-title">
              <div>
                <h2 id="mine-camp-title">The Mine</h2>
                <p>{miningRules.startingEnergy} energy · Floor 1</p>
                <button type="button" className="mine-button mine-primary" aria-disabled={blocked} onClick={start}>Start Expedition</button>
              </div>
              <div className="mine-camp-art" aria-hidden="true">
                <RockArt type="copper-flecked" />
                <RockArt type="crystalline" />
                <RockArt type="coal-flecked" />
              </div>
            </section>
            <div className="mine-camp-panels">
              <section className="mine-panel" aria-labelledby="mine-inventory-title">
                <h2 id="mine-inventory-title">Permanent Inventory</h2>
                {inventory.length ? <ul className="mine-resources">
                  {inventory.map(item => <li key={item.id}><ResourceIcon id={item.id} /><span>{item.name}</span><strong>{item.quantity}</strong></li>)}
                </ul> : <p className="mine-muted">Your secured resources will appear here.</p>}
              </section>
              <section className="mine-panel" aria-labelledby="mine-stat-title">
                <h2 id="mine-stat-title">Expedition Statistics</h2>
                <dl className="mine-stat-grid">
                  <div><dt>Deepest floor</dt><dd>{stats.deepestFloor || "—"}</dd></div>
                  <div><dt>Expeditions</dt><dd>{stats.expeditions}</dd></div>
                  <div><dt>Safe returns</dt><dd>{stats.returned}</dd></div>
                  <div><dt>Pass-outs</dt><dd>{stats.passedOut}</dd></div>
                </dl>
                {latest && <button type="button" className="mine-button mine-secondary" onClick={() => setShowSummary(true)}>Last Expedition</button>}
              </section>
            </div>
          </div>
        )}
      </div>
      <Effects effects={effects} />
      {catalogueOpen && <Catalogue history={catalogue} close={() => setCatalogueOpen(false)} viewRock={recordCatalogueView} />}
    </main>
  );
}
