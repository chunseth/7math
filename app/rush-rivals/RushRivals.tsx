"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Answer from "../mentalist/components/Answer";
import QuestionPrompt, { useQuestionPart } from "../mentalist/components/QuestionPrompt";
import { Visual } from "../mentalist/components/Visual";
import AccountGate from "../rush/AccountGate";
import { post, RequestError } from "../../lib/mentalist/client";
import { studentPrompt } from "../../lib/mentalist/least-order";
import { formatRunTime, type Question } from "../../lib/mentalist/model";
import { effectiveMistakes, raceLimitMs, type RivalProgress, type RivalsAnswer, type RivalsState } from "../../lib/rivals/model";
import { rushGrades, rushLength, type RushGrade } from "../../lib/rush/model";

type Submission = { id: string; match: string; question: number; raw: string | null };
type RaceState = Extract<RivalsState, { match: string }>;
const idle = { phase: "idle" } as const;

export default function RushRivals({ available, hasSession }: { available: boolean; hasSession: boolean }) {
  const [signedIn, setSignedIn] = useState(hasSession);
  const [view, setView] = useState<RivalsState | null>(null);
  const [grade, setGrade] = useState<RushGrade>(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const pending = useRef(false);
  const version = useRef(0);
  const watch = useRef(true);

  function update(next: RivalsState) {
    watch.current = next.phase !== "idle" && next.phase !== "result";
    setView(next);
    setOffline(false);
  }

  function resetSession() {
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
          const next = await post<RivalsState>({ action: "rivalsState" });
          if (disposed) return;
          if (requestVersion === version.current) {
            update(next);
            if (next.phase === "countdown") delay = Math.max(50, Math.min(delay, next.startsAt - next.serverNow));
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
      await request<RivalsState>(body, value => value);
    } catch (problem) {
      setError(problem instanceof RequestError ? problem.message : "Could not connect. Try again.");
    }
  }

  function findMatch(selected: RushGrade) {
    setGrade(selected);
    void change({ action: "rivalsJoin", grade: selected });
  }

  return <main className="mt-shell rush-shell rivals-shell">
    <header className="mt-top">
      <Link href="/" aria-label="Main menu">‹</Link>
      <h1>Rush Rivals</h1>
    </header>
    <div className="rivals-content">
      {!available ? <p role="alert">Rush Rivals is currently unavailable.</p> :
        !signedIn ? <AccountGate mode="Rush Rivals" onSuccess={() => setSignedIn(true)} /> :
        !view ? <p role="status">{offline ? "Connection lost. Reconnecting…" : "Checking for a match…"}</p> :
        view.phase === "idle" ? <section className="rivals-lobby">
          <h2>Find a rival</h2>
          <p>Race through 12 questions. Fewest mistakes wins. Speed breaks a tie.</p>
          <div className="rivals-grades" aria-label="Choose your grade">
            {rushGrades.map(value => <button type="button" key={value} aria-pressed={value === grade}
              disabled={busy} onClick={() => setGrade(value)}>{value}math</button>)}
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
          submit={submission => request<RivalsAnswer>({ action: "rivalsAnswer", ...submission }, value => value.state)}
          forfeit={() => void change({ action: "rivalsForfeit", match: view.match })}
          again={() => findMatch(view.grade)} chooseGrade={() => {
            setGrade(view.grade);
            setView(idle);
            setError("");
          }} />}
      {view && offline && <p className="rivals-notice" role="status">Connection lost. Reconnecting…</p>}
      {error && <p className="rivals-notice" role="alert">{error}</p>}
    </div>
  </main>;
}

function Race({ view, busy, submit, forfeit, again, chooseGrade }: {
  view: RaceState;
  busy: boolean;
  submit: (submission: Submission) => Promise<RivalsAnswer | undefined>;
  forfeit: () => void;
  again: () => void;
  chooseGrade: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { phase, grade, you, opponent, result } = view;
  const timedOut = result?.reason === "deadline";
  return <section className="rivals-race" aria-label={`${grade}math race`}>
    <Track player={you} label="You" timedOut={timedOut} />
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
          <h2 aria-live="polite">{result.outcome === "win" ? "You win!" : result.outcome === "loss" ? "Your rival wins" :
            result.outcome === "draw" ? "It’s a draw" : "No contest"}</h2>
          {result.reason === "forfeit" && <p>The match ended in a forfeit.</p>}
          {timedOut && <p>Time’s up. Unanswered questions count as mistakes.</p>}
          <div className="rivals-results">
            <Finish player={you} label="You" timedOut={timedOut} />
            <Finish player={opponent} label={opponent.username} timedOut={timedOut} />
          </div>
          <div className="rivals-actions">
            <button className="rivals-primary" type="button" disabled={busy} onClick={again}>Play again</button>
            <button type="button" disabled={busy} onClick={chooseGrade}>Change grade</button>
          </div>
        </div> : view.question ? <RaceQuestion key={you.resolved} question={view.question} busy={busy}
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
    <Track player={opponent} label={opponent.username} timedOut={timedOut} opponent />
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
    finishedMs ?? Math.round(Math.max(0, Math.min(raceLimitMs, elapsed))),
  )}</time>;
}

function Track({ player, label, timedOut, opponent }: {
  player: RivalProgress; label: string; timedOut?: boolean; opponent?: boolean;
}) {
  const mistakes = timedOut ? effectiveMistakes(player) : player.mistakes;
  return <div className={opponent ? "rivals-track rivals-track-opponent" : "rivals-track"}>
    <span className="rivals-track-name" title={label}>{label}</span>
    <strong aria-label={`${label}, ${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}`}>{mistakes ? `−${mistakes}` : "0"}</strong>
    <div className="rivals-meter" role="progressbar" aria-label={`${label} progress`}
      aria-valuemin={0} aria-valuemax={rushLength} aria-valuenow={player.resolved}>
      {Array.from({ length: rushLength }, (_, index) => <span key={index} data-filled={index < player.resolved} />)}
    </div>
  </div>;
}

function Finish({ player, label, timedOut }: { player: RivalProgress; label: string; timedOut?: boolean }) {
  const mistakes = timedOut ? effectiveMistakes(player) : player.mistakes;
  return <div>
    <strong>{label}</strong>
    <span>{mistakes} {mistakes === 1 ? "mistake" : "mistakes"}</span>
    {player.finishedMs !== null && <span>{formatRunTime(player.finishedMs)}</span>}
  </div>;
}

function RaceQuestion({ question, send, busy }: {
  question: Question;
  busy: boolean;
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
        onAnswer={raw => void submit(raw)} onPart={setPartTitle} singleAttempt fractionDelayMs={450} />
    </div>
    {error && <p role="alert">{error}</p>}
    {retry ? <button type="button" disabled={busy || checking} onClick={() => void submit(retry.raw, retry.id)}>Retry submission</button> :
      <button type="button" disabled={busy || checking} onClick={() => void submit(null)}>Skip question</button>}
  </div>;
}
