"use client";
import { useEffect, useRef, useState } from "react";
import { formatRunTime, levelById, skillById, type RunView, type Outcome, sprites } from "../../../lib/mentalist/model";
import { post, RequestError } from "../../../lib/mentalist/client";
import Answer from "./Answer";
import { Visual } from "./Visual";
import { Leaderboard } from "./Leaderboard";
type Pending = {
  action: "answer";
  id: string;
  run: string;
  encounter: string;
  raw: string;
  revision: number;
  elapsed: number;
};
export function Battle({
  initial,
  sprite,
  username,
  onReturn,
  onRestart,
}: {
  initial: RunView;
  sprite: string;
  username: string;
  onReturn: (id: string) => void;
  onRestart: (id: string) => void;
}) {
  const [run, setRun] = useState(initial),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false);
  const [reset, setReset] = useState(0),
    [feedback, setFeedback] = useState(""),
    [hit, setHit] = useState({ n: 0, type: "" });
  const [simulated, setSimulated] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const pending = useRef<Pending | null>(null),
    sending = useRef(false);
  const time = useRef({ sum: 0, start: performance.now() as number | null });
  function pause() {
    if (time.current.start !== null) {
      time.current.sum += performance.now() - time.current.start;
      time.current.start = null;
    }
  }
  function resume() {
    if (time.current.start === null && !document.hidden && navigator.onLine && !pending.current)
      time.current.start = performance.now();
  }
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine || document.hidden || leaving) pause();
      else resume();
    };
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("offline", update);
    window.addEventListener("online", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("online", update);
    };
  }, [leaving]);
  async function deliver() {
    if (!pending.current || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    const event = pending.current;
    try {
      const res = await post<{ run: RunView; outcome: Outcome }>(event);
      pending.current = null;
      time.current = { sum: 0, start: null };
      resume();
      setRun(res.run);
      setHit((h) => ({ n: h.n + 1, type: res.outcome }));
      if (res.outcome === "incorrect") {
        setFeedback(`${event.raw} was incorrect. Try again.`);
        setReset((n) => n + 1);
      } else if (res.outcome === "simplification") setFeedback("Equivalent fraction. Simplify your answer.");
      else {
        setFeedback("");
        setReset(0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection lost.");
      if (e instanceof RequestError && [401, 403, 404, 409].includes(e.status)) setStale(true);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (online && pending.current) void deliver();
  }, [online]);
  function answer(raw: string) {
    if (!run.encounter || pending.current || sending.current || !navigator.onLine || document.hidden) return;
    pause();
    pending.current = {
      action: "answer",
      id: crypto.randomUUID(),
      run: run.id,
      encounter: run.encounter.id,
      revision: run.encounter.revision,
      raw,
      elapsed: Math.max(1, Math.round(time.current.sum)),
    };
    void deliver();
  }
  const level = levelById.get(run.level)!,
    skill = skillById.get(level.skill)!;
  async function leave() {
    setBusy(true);
    try {
      await post({ action: "leave", id: crypto.randomUUID(), run: run.id });
      onReturn(run.level);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not exit.");
    } finally {
      setBusy(false);
    }
  }
  if (run.status !== "active") {
    const r = run.result;
    return (
      <main className="mt-shell mt-results">
        <section className="mt-result-card">
          <img src={`/sprites/${sprite}.png`} alt="" width="84" height="84" />
          <p>
            {skill.title} · {level.title}
          </p>
          <h1>{r ? (r.passed ? "Level cleared" : "Practice complete") : "Knockdown"}</h1>
          {r ? (
            <>
              <div className="mt-stars" aria-label={r.stars + " stars"}>
                {"★".repeat(r.stars)}
                {"☆".repeat(3 - r.stars)}
              </div>
              <strong className="mt-result-score">{r.firstTry} / 12</strong>
              <p>Correct on the first try</p>
              <dl>
                <dt>Total time · 12 problems</dt>
                <dd>{formatRunTime(r.activeMs)}</dd>
                <dt>Fastest problem</dt>
                <dd>{formatRunTime(r.fastestProblemMs)}</dd>
                {r.stars === 3 && <>
                  <dt>Your rank by best total time</dt>
                  <dd>#{run.leaderboardRank}</dd>
                </>}
                <dt>Fluency target</dt>
                <dd>{r.targetMs / 1000} s</dd>
                <dt>Attempt accuracy</dt>
                <dd>{Math.round(r.attemptAccuracy * 100)}%</dd>
                <dt>Retries · Simplifications</dt>
                <dd>
                  {r.retries} · {r.simplifications}
                </dd>
              </dl>
              {r.stars < 3 && <p>Get 3 stars to join the leaderboards.</p>}
            </>
          ) : (
            <p>You resolved {run.resolved} of 12 questions. Your earned rewards are saved.</p>
          )}
          <dl>
            <dt>Enemies defeated</dt>
            <dd>{run.defeats}</dd>
            <dt>Skill cards</dt>
            <dd>+{run.resolved}</dd>
            <dt>Coins · XP</dt>
            <dd>
              +{run.resolved * 10} · +{run.resolved * 10}
            </dd>
            {run.chest && (
              <>
                <dt>Chest earned</dt>
                <dd>1</dd>
              </>
            )}
            {run.bonusPaid && (
              <>
                <dt>Perfect review bonus</dt>
                <dd>+25 coins</dd>
              </>
            )}
          </dl>
          {run.next && (
            <p>
              Next on your trail · {skillById.get(levelById.get(run.next.level)!.skill)!.title} ·{" "}
              {levelById.get(run.next.level)!.title}
            </p>
          )}
          {r && <button onClick={() => setShowBoard(true)}>View leaderboard</button>}
          {!r && (
            <button className="mt-primary" onClick={() => onRestart(run.level)}>
              Restart level
            </button>
          )}
          <button className={r ? "mt-primary" : ""} onClick={() => onReturn(run.level)}>
            Return to trail
          </button>
        </section>
        {showBoard && <Leaderboard initialLevel={run.level} username={username} close={() => setShowBoard(false)} />}
      </main>
    );
  }
  const e = run.encounter!;
  return (
    <main className="mt-shell mt-battle">
      <header>
        <button
          onClick={() => {
            pause();
            setLeaving(true);
          }}
          disabled={busy}
          aria-label="Leave battle"
        >
          ← Trail
        </button>
        <span>{skill.title}</span>
        <b>{e.position} / 12</b>
      </header>
      <div
        className={`mt-fighters ${hit.type === "correct" ? "is-correct" : hit.type === "incorrect" ? "is-timeout" : ""}`}
        key={hit.n}
      >
        {[
          [sprite, run.hp, 100, "player-fighter"],
          [
            sprites[(sprites.indexOf(sprite) + 4 + run.defeats) % sprites.length],
            run.enemy_hp,
            40,
            "challenger-fighter",
          ],
        ].map(([name, hp, max, cls]) => (
          <div className={String(cls)} key={String(cls)}>
            <img src={`/sprites/${name}.png`} alt={String(name)} />
            <label>
              {name} · {hp}/{max}
              <progress value={Number(hp)} max={Number(max)} />
            </label>
          </div>
        ))}
      </div>
      <section className="mt-prompt" key={e.id}>
        <p>{level.title}</p>
        <h1>{e.question.prompt}</h1>
        <Visual data={e.question.visual} onSimulated={() => setSimulated(e.id)} />
      </section>
      <div className="mt-input-area">
        <p className="mt-feedback" role="status">
          {!online ? "Offline · Battle paused" : error || feedback}
        </p>
        {stale ? (
          <button onClick={() => onReturn(run.level)}>Return to trail</button>
        ) : (
          error &&
          pending.current && (
            <button onClick={deliver} disabled={busy || !online}>
              Retry saving answer
            </button>
          )
        )}
        <Answer
          key={e.id + "." + reset}
          control={e.question.control}
          disabled={
            busy ||
            !!pending.current ||
            !online ||
            leaving ||
            (e.question.visual?.kind === "simulation" && simulated !== e.id)
          }
          onAnswer={answer}
        />
      </div>
      {leaving && (
        <div className="mt-overlay">
          <section role="dialog" aria-modal="true" className="mt-sheet">
            <h2>Leave this battle?</h2>
            <p>Your answers and rewards are saved. Playing again starts another set at question one.</p>
            <button className="mt-primary" disabled={busy} onClick={() => setLeaving(false)}>
              Keep playing
            </button>
            <button disabled={busy} onClick={leave}>
              Leave battle
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
