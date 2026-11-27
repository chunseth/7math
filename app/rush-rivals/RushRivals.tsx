"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Answer from "../mentalist/components/Answer";
import QuestionPrompt, { useQuestionPart } from "../mentalist/components/QuestionPrompt";
import { Visual } from "../mentalist/components/Visual";
import AccountGate from "../rush/AccountGate";
import { post, RequestError } from "../../lib/mentalist/client";
import { studentPrompt } from "../../lib/mentalist/least-order";
import { formatRunTime, type Question } from "../../lib/mentalist/model";
import { effectiveMistakes, type QueueCounts, type RivalProgress, type RivalsAnswer, type RivalsState } from "../../lib/rivals/model";
import { sprites } from "../../lib/mentalist/sprites";
import { rushGrades, rushLength, type RushGrade } from "../../lib/rush/model";

type Submission = { id: string; match: string; question: number; raw: string | null };
type Draft = Omit<Submission, "id" | "raw"> & { draft: string };
type RaceState = Extract<RivalsState, { match: string }>;

export default function RushRivals({ available, hasSession }: { available: boolean; hasSession: boolean }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(hasSession);
  const [view, setView] = useState<RivalsState | null>(null);
  const [grade, setGrade] = useState<RushGrade>(7);
  const [counts, setCounts] = useState<QueueCounts>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const pending = useRef(false);
  const version = useRef(0);
  const watch = useRef(true);
  const snapshot = useRef<RivalsState | null>(null);
  const draft = useRef<Draft | undefined>(undefined);
  const showQueue = signedIn && (view?.phase === "idle" || view?.phase === "waiting");

  function update(next: RivalsState) {
    snapshot.current = next;
    watch.current = next.phase !== "idle" && next.phase !== "result";
    setView(next);
    setOffline(false);
  }

  function resetSession() {
    snapshot.current = null;
    draft.current = undefined;
    setCounts(undefined);
    setView(null);
    setSignedIn(false);
    setError("");
    setOffline(false);
    watch.current = true;
  }

  useEffect(() => {
    if (!available || !signedIn) return;
    let disposed = false;
    let timer: number;
    async function poll() {
      let delay = 1000;
      if (!pending.current && watch.current) {
        const requestVersion = version.current;
        try {
          const current = snapshot.current;
          const preview = current?.phase === "racing" && current.opponent.finishedMs !== null ? draft.current : undefined;
          const next = await post<RivalsState>({ action: "rivalsState", ...preview });
          if (disposed) return;
          if (requestVersion === version.current) {
            update(next);
            if (next.phase === "countdown") delay = Math.max(50, Math.min(delay, next.startsAt - next.serverNow));
            if (next.phase === "racing" && (next.spectating || next.opponent.finishedMs !== null)) delay = 400;
          }
        } catch (problem) {
          if (disposed) return;
          if (requestVersion === version.current) {
            if (problem instanceof RequestError && problem.status === 401) resetSession();
            else setOffline(true);
          }
        }
      }
      timer = window.setTimeout(poll, delay);
    }
    void poll();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [available, signedIn]);

  useEffect(() => {
    if (!showQueue) return;
    let disposed = false;
    let timer: number;
    async function refresh() {
      try {
        const next = await post<QueueCounts>({ action: "rivalsQueue" });
        if (!disposed) setCounts(next);
      } catch {
        if (!disposed) setCounts(undefined);
      } finally {
        if (!disposed) timer = window.setTimeout(refresh, 2500);
      }
    }
    void refresh();
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [showQueue]);

  async function request<T>(body: Record<string, unknown>, snapshot: (value: T) => RivalsState) {
    if (pending.current) return;
    pending.current = true;
    watch.current = true;
    version.current++;
    setBusy(true);
    setError("");
    try {
      const value = await post<T>(body);
      update(snapshot(value));
      return value;
    } catch (problem) {
      if (problem instanceof RequestError && problem.status === 401) resetSession();
      else throw problem;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function change(body: Record<string, unknown>) {
    try {
      return await request<RivalsState>(body, value => value);
    } catch (problem) {
      setError(problem instanceof RequestError ? problem.message : "Could not connect. Try again.");
    }
  }

  function findMatch(selected: RushGrade) {
    setGrade(selected);
    void change({ action: "rivalsJoin", grade: selected });
  }

  async function leave(mainMenu: boolean) {
    if (pending.current) return;
    const next = await change({ action: "rivalsLeave" });
    if (!next) return;
    draft.current = undefined;
    if (mainMenu) router.push("/");
  }

  return <main className="mt-shell rush-shell rivals-shell">
    <header className="mt-top">
      <Link href="/" aria-label="Main menu" aria-disabled={busy || undefined} onNavigate={event => {
        if (!available || !signedIn) return;
        event.preventDefault();
        void leave(true);
      }}>‹</Link>
      <h1>Rush Rivals</h1>
    </header>
    <div className="rivals-content">
      {!available ? <p role="alert">Rush Rivals is currently unavailable.</p> :
        !signedIn ? <AccountGate mode="Rush Rivals" onSuccess={() => setSignedIn(true)} /> :
        !view ? <p role="status">{offline ? "Connection lost. Reconnecting…" : "Checking for a match…"}</p> :
        view.phase === "idle" ? <section className="rivals-lobby">
          <h2>Find a rival</h2>
          <p>Race through 12 questions. Finish with as few mistakes as you can.</p>
          <div className="rivals-grades" aria-label="Choose your grade">
            {rushGrades.map(value => <button type="button" key={value} aria-pressed={value === grade}
              disabled={busy} onClick={() => setGrade(value)}><strong>{value}math</strong>
              <small>{counts ? `${counts[value]} in queue` : "Queue —"}</small>
            </button>)}
          </div>
          <button className="rivals-primary" type="button" disabled={busy} onClick={() => findMatch(grade)}>
            Find a match
          </button>
        </section> : view.phase === "waiting" ? <section className="rivals-lobby">
          <h2>Finding a {view.grade}math rival</h2>
          <p role="status">Waiting for another player…</p>
          <button type="button" disabled={busy} onClick={() => void change({ action: "rivalsCancel", ticket: view.ticket })}>
            Cancel search
          </button>
        </section> : <Race key={view.match} view={view} busy={busy}
          onDraft={value => { draft.current = value; }}
          submit={submission => request<RivalsAnswer>({ action: "rivalsAnswer", ...submission }, value => value.state)}
          forfeit={() => void change({ action: "rivalsForfeit", match: view.match })}
          again={() => findMatch(view.grade)} rivalsMenu={() => {
            setGrade(view.grade);
            void leave(false);
          }} />}
      {view && offline && <p className="rivals-notice" role="status">Connection lost. Reconnecting…</p>}
      {error && <p className="rivals-notice" role="alert">{error}</p>}
    </div>
  </main>;
}

function Race({ view, busy, onDraft, submit, forfeit, again, rivalsMenu }: {
  view: RaceState;
  busy: boolean;
  onDraft: (value: Draft) => void;
  submit: (submission: Submission) => Promise<RivalsAnswer | undefined>;
  forfeit: () => void;
  again: () => void;
  rivalsMenu: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { phase, grade, you, opponent, result } = view;
  const timedOut = result?.reason === "deadline";
  const winner = result?.outcome === "win" ? you : result?.outcome === "loss" ? opponent : null;
  return <section className="rivals-race" aria-label={`${grade}math race`}>
    <Track player={you} timedOut={timedOut} />
    <div className="rivals-center">
      <div className="rivals-race-meta">
        <span>{grade}math</span>
        {phase === "racing" && <RaceClock start={view.startsAt} serverNow={view.serverNow} finishedMs={you.finishedMs} />}
      </div>
      <div className="rivals-question">
        {phase === "countdown" ? <div className="rivals-message">
          <h2>Get ready</h2>
          <Countdown start={view.startsAt} serverNow={view.serverNow} />
        </div> : result ? <div className="rivals-message">
          <h2 className={result.outcome === "win" ? "rush-grade-title rivals-win-title" : undefined} aria-live="polite">{result.outcome === "win" ? "You win!" : result.outcome === "loss" ? "Your rival wins" :
            result.outcome === "draw" ? "It’s a draw" : "No contest"}</h2>
          {result.reason === "forfeit" && <p>The match ended in a forfeit.</p>}
          <div className="rivals-results">
            <Finish player={winner ?? you} winner={winner ? true : undefined} noContest={result.outcome === "no contest"} timedOut={timedOut} />
            <Finish player={winner === you ? opponent : winner === opponent ? you : opponent}
              winner={winner ? false : undefined} noContest={result.outcome === "no contest"} timedOut={timedOut} />
          </div>
          <div className="rivals-actions">
            <button className="rivals-primary" type="button" disabled={busy} onClick={again}>Play again</button>
            <button type="button" disabled={busy} onClick={rivalsMenu}>Rivals Menu</button>
          </div>
        </div> : view.spectating ? <div className="rivals-message rivals-spectator">
          <h2>Spectator mode</h2>
          <p>Viewing {opponent.username} · Question {opponent.resolved + 1} of {rushLength}</p>
          <div><QuestionPrompt part="" text={studentPrompt(view.spectating.question)} /></div>
          <div inert hidden={!view.spectating.question.visual}>
            <Visual key={opponent.resolved} data={view.spectating.question.visual} showLoan={false} />
          </div>
          <div className="rivals-live-draft">
            <span>Live answer</span>
            <output aria-live="off">{view.spectating.draft || "Waiting for input…"}</output>
          </div>
        </div> : view.question ? <RaceQuestion key={you.resolved} question={view.question} busy={busy}
          onDraft={draft => onDraft({ match: view.match, question: you.resolved, draft })}
          send={(id, raw) => submit({ id, raw, match: view.match, question: you.resolved })} /> :
          <div className="rivals-message"><h2>You finished!</h2><p role="status">Waiting for your rival to finish…</p></div>}
      </div>
      {phase !== "result" && <div className="rivals-exit">
        {confirming ? <>
          <span>Leave this match and concede the win?</span>
          <button type="button" disabled={busy} onClick={forfeit}>Forfeit match</button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)}>Keep playing</button>
        </> : <button type="button" disabled={busy} onClick={() => setConfirming(true)}>Forfeit</button>}
      </div>}
    </div>
    <Track player={opponent} timedOut={timedOut} opponent />
  </section>;
}

function useElapsed(start: number, serverNow: number) {
  const [elapsed, setElapsed] = useState(serverNow - start);
  useEffect(() => {
    const anchor = performance.now();
    const update = () => setElapsed(serverNow - start + performance.now() - anchor);
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [start, serverNow]);
  return elapsed;
}

function Countdown({ start, serverNow }: { start: number; serverNow: number }) {
  const seconds = Math.ceil(-useElapsed(start, serverNow) / 1000);
  return <p className="rivals-countdown" role="status">{seconds > 0 ? seconds : "Go!"}</p>;
}

function RaceClock({ start, serverNow, finishedMs }: { start: number; serverNow: number; finishedMs: number | null }) {
  const elapsed = useElapsed(start, serverNow);
  return <time role="timer" aria-label="Your elapsed time">{formatRunTime(
    finishedMs ?? Math.round(Math.max(0, elapsed)),
  )}</time>;
}

function Track({ player, timedOut, opponent }: {
  player: RivalProgress; timedOut?: boolean; opponent?: boolean;
}) {
  const mistakes = timedOut ? effectiveMistakes(player) : player.mistakes;
  const label = opponent ? player.username : "You";
  return <div className={opponent ? "rivals-track rivals-track-opponent" : "rivals-track"}>
    <PlayerSprite player={player} />
    <span className="rivals-track-name">{player.username}</span>
    <strong aria-label={`${label}, ${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}`}>{mistakes ? `−${mistakes}` : "0"}</strong>
    <div className="rivals-meter" role="progressbar" aria-label={`${label} progress`}
      aria-valuemin={0} aria-valuemax={rushLength} aria-valuenow={player.resolved}
      aria-valuetext={`${player.resolved} of ${rushLength} resolved${player.missed.length ? `; missed ${player.missed.map(index => index + 1).join(", ")}` : ""}`}>
      {Array.from({ length: rushLength }, (_, index) => <span key={index}
        data-result={player.missed.includes(index) ? "incorrect" : index < player.resolved ? "correct" : undefined} />)}
    </div>
  </div>;
}

function PlayerSprite({ player }: { player: RivalProgress }) {
  const name = sprites.includes(player.sprite) ? player.sprite : "raijin";
  return <img className="rivals-sprite" src={`/sprites/${name}.png`} alt="" draggable={false} />;
}

function Finish({ player, winner, noContest, timedOut }: {
  player: RivalProgress; winner?: boolean; noContest: boolean; timedOut?: boolean;
}) {
  const mistakes = timedOut ? effectiveMistakes(player) : player.mistakes;
  return <div className="rivals-podium" data-winner={winner}>
    {winner && <Confetti />}
    <PlayerSprite player={player} />
    <strong>{player.username}</strong>
    <span>{mistakes} {mistakes === 1 ? "mistake" : "mistakes"}</span>
    {player.finishedMs !== null && <span>{formatRunTime(player.finishedMs)}</span>}
    <div className="rivals-podium-step">{noContest ? "No contest" : winner === undefined ? "Tied" : winner ? "1st" : "2nd"}</div>
  </div>;
}

const confettiColors = ["#e53276", "#ff7448", "#f6bd24", "#60aa31", "#10aa93", "#318bee", "#8754d9", "#e140b0"];

function Confetti() {
  const [particles] = useState(() => {
    const between = (min: number, max: number) => min + Math.random() * (max - min);
    return Array.from({ length: 36 }, (_, index) => {
      const direction = Math.random() < 0.5 ? -1 : 1;
      const size = between(3, 7);
      return {
        "--confetti-drift": `${direction * between(8, 42)}px`,
        "--confetti-sway": `${-direction * between(2, 22)}px`,
        "--confetti-spin": `${direction * between(200, 960)}deg`,
        "--confetti-start-angle": `${between(0, 360)}deg`,
        animationDelay: `${between(0, 0.85)}s`,
        animationDuration: `${between(1.35, 2.8)}s`,
        backgroundColor: confettiColors[index % confettiColors.length],
        borderRadius: Math.random() < 0.25 ? "50%" : "1px",
        height: `${size * between(0.7, 1.85)}px`,
        left: `${between(1, 97)}%`,
        width: `${size}px`,
      } as CSSProperties;
    });
  });

  return <div className="rivals-confetti" aria-hidden="true">
    {particles.map((style, index) => <i key={index} style={style} />)}
  </div>;
}

function RaceQuestion({ question, send, busy, onDraft }: {
  question: Question;
  busy: boolean;
  onDraft: (value: string) => void;
  send: (id: string, raw: string | null) => Promise<RivalsAnswer | undefined>;
}) {
  const { partTitle, setPartTitle } = useQuestionPart(question);
  const [checking, setChecking] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reduce, setReduce] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<{ id: string; raw: string | null } | null>(null);
  const locked = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { heading.current?.focus(); }, []);

  async function submit(raw: string | null, id = crypto.randomUUID()) {
    if (busy || locked.current) return;
    locked.current = true;
    setChecking(true);
    setError("");
    try {
      const response = await send(id, raw);
      setRetry(null);
      if (response?.outcome === "simplification" && raw) {
        setReduce(raw);
        onDraft("");
        setAttempt(value => value + 1);
      }
    } catch (problem) {
      if (problem instanceof RequestError && problem.status < 500) {
        setError(problem.message);
        setRetry(null);
        setAttempt(value => value + 1);
      } else {
        setError("Could not confirm your submission.");
        setRetry({ id, raw });
      }
    } finally {
      locked.current = false;
      setChecking(false);
    }
  }

  return <div className="rivals-play">
    <h2 ref={heading} tabIndex={-1} aria-live="polite">
      <QuestionPrompt part={partTitle} text={reduce ? `Reduce ${reduce}.` : studentPrompt(question)} />
    </h2>
    <Visual data={question.visual} showLoan={false} onSimulated={() => setSimulated(true)} />
    <div className="rush-answer">
      <Answer key={question.visual?.kind === "loan" ? "loan" : attempt} question={question}
        disabled={busy || checking || !!retry || (question.visual?.kind === "simulation" && !question.visual.coinTrials && !simulated)}
        onAnswer={raw => void submit(raw)} onDraft={onDraft} onPart={setPartTitle} singleAttempt fractionDelayMs={450} />
    </div>
    {error && <p role="alert">{error}</p>}
    {retry ? <button type="button" disabled={busy || checking} onClick={() => void submit(retry.raw, retry.id)}>Retry submission</button> :
      <button type="button" disabled={busy || checking} onClick={() => void submit(null)} className="rivals-skip">Skip question</button>}
  </div>;
}
