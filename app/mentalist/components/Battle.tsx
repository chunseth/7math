"use client";
import { useEffect, useRef, useState } from "react";
import { cardTitles, cardTopic, formatRunTime, levelById, skillById, type RunView, sprites } from "../../../lib/mentalist/model";
import { discardRound, post, RequestError, storeRound } from "../../../lib/mentalist/client";
import Answer from "./Answer";
import { Visual } from "./Visual";
import { Leaderboard } from "./Leaderboard";
import { advance, checkLocally, type RoundDraft } from "../../../lib/mentalist/round";

export function Battle({
  initial,
  profile,
  sprite,
  username,
  onReturn,
  onRestart,
}: {
  initial: RoundDraft;
  profile: string;
  sprite: string;
  username: string;
  onReturn: (id: string) => void;
  onRestart: (id: string) => void;
}) {
  const [run, setRun] = useState<RunView>(initial.run),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true),
    [error, setError] = useState(""),
    [stale, setStale] = useState<"expired" | "ended" | null>(null);
  const [reset, setReset] = useState(0),
    [feedback, setFeedback] = useState(""),
    [hit, setHit] = useState({ n: 0, type: "" });
  const [simulated, setSimulated] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const draft = useRef(initial);
  const saving = useRef(false), checking = useRef(false);
  const [ending, setEnding] = useState(initial.save);
  const time = useRef({ sum: initial.activeMs, start: performance.now() as number | null });
  function pause() {
    if (time.current.start !== null) {
      time.current.sum += performance.now() - time.current.start;
      time.current.start = null;
    }
  }
  function resume() {
    if (time.current.start === null && !document.hidden && !draft.current.save)
      time.current.start = performance.now();
  }
  function remember(next: RoundDraft) {
    draft.current = next;
    storeRound(profile, next);
  }
  function forget() {
    discardRound(profile, draft.current.run.id);
  }
  useEffect(() => {
    const saveTime = () => {
      pause();
      if (!draft.current.save && !checking.current)
        remember({ ...draft.current, activeMs: time.current.sum });
    };
    const update = () => {
      setOnline(navigator.onLine);
      if (document.hidden || leaving) saveTime();
      else resume();
    };
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pagehide", saveTime);
    window.addEventListener("pageshow", update);
    window.addEventListener("offline", update);
    window.addEventListener("online", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pagehide", saveTime);
      window.removeEventListener("pageshow", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("online", update);
    };
  }, [leaving]);
  async function deliver() {
    const d = draft.current;
    if (!d.save || saving.current || !navigator.onLine) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await post<RunView>({
        action: "saveBattle", id: d.run.id, run: d.run.id, attempts: d.attempts, leave: d.save === "leave",
      });
      forget();
      if (result.status === "interrupted") onReturn(result.level);
      else setRun(result);
      setEnding(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your level.");
      if (e instanceof RequestError && e.status === 401) setStale("expired");
      else if (e instanceof RequestError && [403, 404, 409].includes(e.status)) setStale("ended");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (ending && online) void deliver();
  }, [ending, online]);
  async function answer(raw: string, calculated = false) {
    const d = draft.current;
    const current = d.run;
    if (!current.encounter || d.save || checking.current || leaving || document.hidden) return;
    checking.current = true;
    pause();
    const at = Math.max(d.attempts.at(-1)?.at ?? 0, Date.now() - d.started);
    const elapsed = Math.max(1, Math.round(time.current.sum));
    try {
      const rules = current.rules;
      const outcome = await checkLocally(d.pack, rules.order[current.resolved], raw);
      if (calculated && outcome !== "correct") return;
      const combat = advance(current, rules, outcome);
      const next = { ...current, ...combat };
      const done = next.hp === 0 || next.resolved === 12;
      if (outcome === "correct" && !done) {
        const position = next.resolved + 1;
        next.encounter = { id: next.id + "." + position, revision: 0, position,
          question: d.pack.questions[rules.order[next.resolved]] };
      } else next.encounter = { ...current.encounter, revision: current.encounter.revision + 1 };
      remember({ ...d, run: next, activeMs: 0, attempts: [...d.attempts, { raw, elapsed, at }], save: done ? "finish" : null });
      setRun(next);
      setHit(h => ({ n: h.n + 1, type: outcome }));
      setError("");
      if (outcome === "incorrect") {
        setFeedback(raw + " was incorrect. Try again.");
        setReset(n => n + 1);
      } else if (outcome === "simplification") setFeedback(`${raw} is equivalent. Write it in simplest form.`);
      else { setFeedback(""); setReset(0); }
      if (done) setEnding("finish");
      time.current.sum = 0;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check this answer.");
      setReset(n => n + 1);
    } finally { checking.current = false; resume(); }
  }
  const level = levelById.get(run.level)!,
    skill = skillById.get(level.skill)!;
  function leave() {
    if (checking.current || draft.current.save) return;
    remember({ ...draft.current, save: "leave" });
    setLeaving(false);
    setEnding("leave");
  }
  if (ending) return <main className="mt-shell mt-results"><section className="mt-result-card">
    <h1>{ending === "leave" ? "Saving progress" : "Saving level"}</h1>
    <p role="status">{error || (online ? "Saving your answers and rewards…" : "Your answers will sync when you reconnect.")}</p>
    {error && !stale && <button disabled={busy || !online} onClick={deliver}>Retry saving level</button>}
    {stale && <button onClick={() => {
      if (stale === "ended") forget();
      onReturn(run.level);
    }}>{stale === "expired" ? "Sign in to save" : "Return to trail"}</button>}
  </section></main>;
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
              {!!r.missingEvidence?.length && <p>To clear, get at least one of each of these right on the first try: {r.missingEvidence.join(", ")}.</p>}
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
            <dt>{cardTitles[cardTopic(level.skill)]} cards</dt>
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
        <Visual data={e.question.visual} showLoan={false} onSimulated={() => setSimulated(e.id)} />
      </section>
      <div className="mt-input-area">
        <p className="mt-feedback" role="status">
          {error || feedback || (!online ? "Playing offline" : "")}
        </p>
        <Answer
          key={e.id + "." + (e.question.visual?.kind === "loan" ? 0 : reset)}
          question={e.question}
          disabled={
            busy ||
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
            <p>Leaving saves your answers and earned rewards. Playing again starts a new set.</p>
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
