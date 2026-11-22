"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { post, RequestError } from "../../lib/mentalist/client";
import {
  BOSS_HEALTH, CHARGE_MS, chooseUpgrade, createRun, editAnswer, radius, resizeRun,
  stepRun, upgradeChoices, type Point, type Run, type Upgrade,
} from "../../lib/survivor/arena";
import type { SurvivorPack } from "../../lib/survivor/pack";

type LobbyState = { status: "loading" | "sign-in" | "error" } | { status: "ready"; pack: SurvivorPack; play: boolean };

export default function Survivor() {
  const [state, setState] = useState<LobbyState>({ status: "loading" });
  const sequence = useRef(0);
  const load = useCallback(async (play = false) => {
    const request = ++sequence.current;
    setState({ status: "loading" });
    try {
      const pack = await post<SurvivorPack>({ action: "survivorPack" });
      if (request === sequence.current) setState({ status: "ready", pack, play: play && pack.topics.length > 0 });
    } catch (error) {
      if (request === sequence.current) setState({ status: error instanceof RequestError && error.status === 401 ? "sign-in" : "error" });
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { sequence.current++; };
  }, [load]);

  if (state.status === "ready" && state.play) return <Arena pack={state.pack} onReplay={() => void load(true)} />;

  const ready = state.status === "ready" && state.pack.topics.length > 0;
  return (
    <main className="sv-shell sv-lobby">
      <Link className="sv-back" href="/">← Modes</Link>
      <section className="sv-entry-panel" aria-labelledby="survivor-title">
        <div className="sv-entry-sprite" aria-hidden="true">
          <img src={`/sprites/${state.status === "ready" ? state.pack.sprite : "phoenix"}.png`} alt="" />
        </div>
        <h1 id="survivor-title">Survivor</h1>
        {state.status === "loading" && <p role="status">Loading your Mentalist questions…</p>}
        {state.status === "sign-in" && <p>Sign in to Mentalist to use your sprite and completed concepts.</p>}
        {state.status === "error" && <p role="alert">Your Mentalist questions could not be loaded.</p>}
        {state.status === "ready" && (ready
          ? <p>Dodge enemy shots and solve the questions above your enemies. Pick up XP to upgrade before the boss arrives at 3:00.</p>
          : <p>Clear every level of a Mentalist concept with text-based numeric questions to unlock Survivor.</p>)}
        {ready && state.status === "ready" && <>
          <p className="sv-controls">Hold or drag to move. On desktop, use the arrow keys or WASD. Correct answers fire as you type.</p>
          <button className="sv-primary" type="button" onClick={() => setState({ ...state, play: true })}>Start run</button>
        </>}
        {state.status === "error" && <button className="sv-primary" type="button" onClick={() => void load()}>Retry</button>}
        {(state.status === "sign-in" || (state.status === "ready" && !ready)) && <Link className="sv-primary" href="/mentalist">Go to Mentalist</Link>}
      </section>
    </main>
  );
}

const movementKeys: Record<string, Point> = {
  w: { x: 0, y: -1 }, ArrowUp: { x: 0, y: -1 }, s: { x: 0, y: 1 }, ArrowDown: { x: 0, y: 1 },
  a: { x: -1, y: 0 }, ArrowLeft: { x: -1, y: 0 }, d: { x: 1, y: 0 }, ArrowRight: { x: 1, y: 0 },
};

const keypad = [
  ["7", "7", "7"], ["8", "8", "8"], ["9", "9", "9"], ["-", "−", "Change sign"], ["/", "/", "Fraction slash"],
  ["4", "4", "4"], ["5", "5", "5"], ["6", "6", "6"], [".", ".", "Decimal point"], ["Backspace", "⌫", "Backspace"],
  ["1", "1", "1"], ["2", "2", "2"], ["3", "3", "3"], ["0", "0", "0"], ["Enter", "↵", "Enter"],
];

function timeLabel(elapsed: number) {
  const seconds = Math.floor(elapsed / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function snapshot(run: Run): Run {
  return {
    ...run, enemy: run.enemy && { ...run.enemy }, orb: run.orb && { ...run.orb },
    drops: [...run.drops], shots: run.shots.map(shot => ({ ...shot })), upgrades: [...run.upgrades],
  };
}

function Arena({ pack, onReplay }: { pack: SurvivorPack; onReplay: () => void }) {
  const field = useRef<HTMLDivElement>(null);
  const run = useRef<Run | null>(null);
  const motion = useRef({ pointer: null as number | null, target: null as Point | null, keys: new Set<string>() });
  const [frame, setFrame] = useState<Run | null>(null);

  function clearMovement() {
    const input = motion.current;
    if (input.pointer !== null && field.current?.hasPointerCapture(input.pointer)) field.current.releasePointerCapture(input.pointer);
    input.pointer = null;
    input.target = null;
    input.keys.clear();
  }

  function keyAnswer(key: string) {
    if (!run.current || document.hidden) return;
    editAnswer(run.current, key);
    if (run.current.phase !== "playing") clearMovement();
    setFrame(snapshot(run.current));
  }

  function pressPad(event: PointerEvent<HTMLButtonElement>, key: string) {
    if (event.button !== 0) return;
    // A second finger may not generate a click while the arena owns the first touch.
    event.preventDefault();
    keyAnswer(key);
  }

  useEffect(() => {
    const arena = field.current!;
    function measure() {
      const { clientWidth: width, clientHeight: height } = arena;
      if (width < 16 || height < 16) return;
      if (run.current) {
        if (width === run.current.size.width && height === run.current.size.height) return;
        clearMovement();
        resizeRun(run.current, { width, height });
      } else run.current = createRun(pack, { width, height });
      setFrame(snapshot(run.current));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(arena);

    let animation = 0;
    let previous: number | undefined;
    function advance(now: number) {
      const active = run.current;
      if (active?.phase === "playing" && !document.hidden) {
        if (previous !== undefined) {
          const input = motion.current;
          const direction = { x: 0, y: 0 };
          for (const key of input.keys) {
            direction.x += movementKeys[key].x;
            direction.y += movementKeys[key].y;
          }
          direction.x = Math.sign(direction.x);
          direction.y = Math.sign(direction.y);
          stepRun(active, { direction, target: input.target }, now - previous);
          if (active.phase !== "playing") clearMovement();
          setFrame(snapshot(active));
        }
        previous = now;
      } else previous = undefined;
      animation = requestAnimationFrame(advance);
    }
    animation = requestAnimationFrame(advance);

    function press(event: KeyboardEvent) {
      if (run.current?.phase !== "playing" || document.hidden || event.altKey || event.metaKey || event.ctrlKey) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (Object.hasOwn(movementKeys, key)) {
        event.preventDefault();
        motion.current.keys.add(key);
      } else if (/^[0-9.\/-]$/.test(key) || ["Backspace", "Delete", "Enter"].includes(key)) {
        if (key === "Enter" && event.target instanceof Element && event.target.closest("button, a")) return;
        event.preventDefault();
        if (!event.repeat || key === "Backspace") keyAnswer(key === "Delete" ? "Clear" : key);
      }
    }
    function release(event: KeyboardEvent) { motion.current.keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key); }
    function blur() {
      previous = undefined;
      clearMovement();
    }
    window.addEventListener("keydown", press);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", blur);
    return () => {
      cancelAnimationFrame(animation);
      observer.disconnect();
      window.removeEventListener("keydown", press);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
    };
  }, [pack]);

  function trackPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    motion.current.target = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function stopPointer(event: PointerEvent<HTMLDivElement>) {
    if (motion.current.pointer !== event.pointerId) return;
    motion.current.pointer = null;
    motion.current.target = null;
  }

  function selectUpgrade(kind: Upgrade) {
    if (!run.current) return;
    chooseUpgrade(run.current, kind);
    setFrame(snapshot(run.current));
  }

  const elapsed = frame?.elapsed ?? 0;
  const clock = timeLabel(elapsed);
  const boss = frame?.enemy?.kind === "boss" ? frame.enemy : null;
  return (
    <main className="sv-shell sv-game">
      <header className="sv-hud">
        <div className="sv-hud-title"><Link className="sv-back" href="/">← Modes</Link><h1>Survivor</h1></div>
        <div className="sv-clock"><time aria-label={`Elapsed ${clock}`}>{clock}</time><span>{frame?.bossArrived ? "Boss fight" : "Boss at 3:00"}</span></div>
        <div className="sv-vitals">
          <label><span>HP <b>{frame?.health ?? 100}/{frame?.maxHealth ?? 100}</b></span><progress value={frame?.health ?? 100} max={frame?.maxHealth ?? 100} /></label>
          <label><span>XP <b>{frame?.xp ?? 0}/{frame?.xpGoal ?? 3}</b></span><progress className="sv-xp-meter" value={frame?.xp ?? 0} max={frame?.xpGoal ?? 3} /></label>
        </div>
      </header>
      <section className="sv-play">
        <div className="sv-field" ref={field} role="region" aria-label="Survivor arena"
          onPointerDown={event => {
            if (run.current?.phase !== "playing" || motion.current.pointer !== null || event.button !== 0) return;
            motion.current.pointer = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            trackPointer(event);
          }}
          onPointerMove={event => { if (motion.current.pointer === event.pointerId) trackPointer(event); }}
          onPointerUp={stopPointer} onPointerCancel={stopPointer} onLostPointerCapture={stopPointer}>
          {frame && <Battlefield frame={frame} />}
        </div>
        <aside className="sv-console" aria-label="Combat controls">
          <div className="sv-combat-info">
            {boss ? <label className="sv-boss-meter"><span>Boss <b>{boss.health}/{BOSS_HEALTH}</b></span><progress value={boss.health} max={BOSS_HEALTH} /></label>
              : <span className="sv-defeated">Enemies defeated <b>{frame?.defeated ?? 0}</b></span>}
            <p className="sv-feedback" role="status">{frame?.feedback}</p>
          </div>
          <div className="sv-pad" role="group" aria-label="Answer keypad">
            <div className="sv-entry"><span aria-label="Current answer" data-empty={!frame?.entry}>{frame?.entry ? frame.entry.replace("-", "−") : "Answer"}</span>
              <button type="button" onPointerDown={event => pressPad(event, "Clear")}
                onClick={event => { if (event.detail === 0) keyAnswer("Clear"); }} disabled={!frame?.entry || frame.phase !== "playing"}>Clear</button>
            </div>
            <div className="sv-keys">
              {keypad.map(([key, symbol, name]) => <button key={key} type="button" data-key={key} aria-label={name}
                disabled={frame?.phase !== "playing"} onPointerDown={event => pressPad(event, key)}
                onClick={event => { if (event.detail === 0) keyAnswer(key); }}>{symbol}</button>)}
            </div>
          </div>
        </aside>
      </section>
      {frame?.phase === "upgrade" && <RunDialog title="Choose an upgrade">
        <div className="sv-upgrades">
          {upgradeChoices(frame).map(choice => <button key={choice.kind} type="button" onClick={() => selectUpgrade(choice.kind)}>
            <strong>{choice.title}</strong><span>{choice.description}</span>
          </button>)}
        </div>
      </RunDialog>}
      {(frame?.phase === "victory" || frame?.phase === "defeat") && <RunDialog title={frame.phase === "victory" ? "Boss defeated" : "Run over"}>
        <dl className="sv-results">
          <div><dt>Time</dt><dd>{clock}</dd></div>
          <div><dt>Enemies defeated</dt><dd>{frame.defeated}</dd></div>
          <div><dt>Upgrades taken</dt><dd>{frame.upgrades.length}</dd></div>
        </dl>
        {frame.upgrades.length > 0 && <ul className="sv-run-upgrades">{frame.upgrades.map((upgrade, index) => <li key={index}>{upgrade.title}</li>)}</ul>}
        <div className="sv-result-actions"><button className="sv-primary" type="button" onClick={onReplay}>Play again</button><Link className="sv-back" href="/">Modes</Link></div>
      </RunDialog>}
    </main>
  );
}

function Battlefield({ frame }: { frame: Run }) {
  const enemy = frame.enemy;
  const orb = frame.orb;
  const boss = enemy?.kind === "boss";
  const charging = boss && enemy.attackAt !== null;
  const closePrompts = boss && orb && Math.abs(enemy.at.x - orb.at.x) < 240 && Math.abs(enemy.at.y - orb.at.y) < 135;
  const orbSide = orb && orb.direction.x > 0 ? "right" : "left";
  const enemySprite = boss ? (frame.sprite === "hydra" ? "jormungandr" : "hydra") : (frame.sprite === "fenrir" ? "oni" : "fenrir");
  return <>
    <div aria-hidden="true" className="sv-field-lines" />
    {frame.drops.map(drop => <div key={drop.id} className="sv-entity sv-drop" style={entityStyle(drop.at, radius(frame, "drop"))} aria-label="XP pickup" />)}
    {frame.shots.map(shot => <div key={shot.id} className="sv-entity sv-shot" style={entityStyle(shot.at, radius(frame, "shot"))} aria-hidden="true" />)}
    <div className="sv-entity sv-player" data-hurt={frame.elapsed < frame.hurtUntil} style={entityStyle(frame.player, radius(frame, "player"))} data-testid="survivor-player">
      <img src={`/sprites/${frame.sprite}.png`} alt="Your sprite" draggable={false} />
    </div>
    {enemy && <>
      <div className={`sv-entity ${boss ? "sv-boss" : "sv-enemy"}`} data-charging={charging} style={entityStyle(enemy.at, radius(frame, enemy.kind))}>
        <img src={`/sprites/${enemySprite}.png`} alt={boss ? "Boss" : "Enemy"} draggable={false} />
      </div>
      <Prompt frame={frame} at={enemy.at} offset={radius(frame, enemy.kind) + 8} text={enemy.question.prompt} kind={enemy.kind}
        side={closePrompts ? (orbSide === "right" ? "left" : "right") : undefined} />
      {charging && <div className="sv-charge" style={{ left: Math.max(37, Math.min(enemy.at.x, frame.size.width - 37)), top: enemy.at.y + radius(frame, "boss") + 8 }}>
        <span>Charging</span><progress aria-label="Boss charge" max={CHARGE_MS} value={CHARGE_MS - (enemy.attackAt! - frame.elapsed)} />
      </div>}
    </>}
    {orb && <>
      <div className="sv-entity sv-orb" style={entityStyle(orb.at, radius(frame, "orb"))} aria-label="Boss orb" />
      <Prompt frame={frame} at={orb.at} offset={radius(frame, "orb") + 7} text={orb.question.prompt} kind="orb"
        side={closePrompts ? orbSide : undefined} />
    </>}
  </>;
}

function entityStyle(at: Point, r: number) {
  return { left: at.x, top: at.y, width: r * 2, height: r * 2 };
}

function Prompt({ frame, at, offset, text, kind, side }: {
  frame: Run; at: Point; offset: number; text: string; kind: "enemy" | "boss" | "orb"; side?: "left" | "right";
}) {
  const { width, height } = frame.size;
  const leftEdge = side === "right" ? width / 2 + 5 : 8;
  const rightEdge = side === "left" ? width / 2 - 5 : width - 8;
  const orbAboveBoss = frame.enemy && at.y < frame.enemy.at.y - 10;
  const below = at.y - offset < 70 || (kind === "orb" && !orbAboveBoss && at.y + offset < height - 70);
  const verticalOffset = below ? `${offset}px` : `calc(-100% - ${offset}px)`;
  const x = `clamp(${leftEdge - at.x}px, -50%, calc(${rightEdge - at.x}px - 100%))`;
  const y = `clamp(${6 - at.y}px, ${verticalOffset}, calc(${height - 6 - at.y}px - 100%))`;
  const style = {
    left: at.x,
    top: at.y,
    maxWidth: Math.min(236, rightEdge - leftEdge),
    transform: `translate(${x}, ${y})`,
  };
  return <div className={`sv-prompt sv-prompt-${kind}`} style={style} aria-live="polite">
    {kind === "orb" && <span>Defuse orb</span>}{kind === "boss" && <span>Attack boss</span>}
    <strong>{text}</strong>
  </div>;
}

function RunDialog({ title, children }: { title: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} className="sv-dialog" aria-labelledby="sv-dialog-title" onCancel={event => event.preventDefault()}>
    <h2 id="sv-dialog-title">{title}</h2>{children}
  </dialog>;
}
