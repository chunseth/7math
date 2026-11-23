"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { post, RequestError } from "../../lib/mentalist/client";
import { formatRunTime, type Outcome } from "../../lib/mentalist/model";
import { checkLocally } from "../../lib/mentalist/round";
import { rushLength, type RushBoard, type RushResult, type RushRun } from "../../lib/rush/model";
import Answer from "../mentalist/components/Answer";
import { emptyCredentials, PlayerFields } from "../mentalist/components/PlayerFields";
import { Visual } from "../mentalist/components/Visual";

type ActiveRun = RushRun & { started: number };
type FinishedRun = RushResult & { runId: string; answers: (string | null)[]; ranked: boolean };

export default function Rush({ rankingEnabled, hasSession }: { rankingEnabled: boolean; hasSession: boolean }) {
  const [signedIn, setSignedIn] = useState(hasSession);
  const [run, setRun] = useState<ActiveRun | null>(null);
  const [finished, setFinished] = useState<FinishedRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error" | null>(null);
  const [board, setBoard] = useState<RushBoard | null>(null);
  const [boardError, setBoardError] = useState("");
  const [boardRevision, setBoardRevision] = useState(0);

  useEffect(() => {
    if (!signedIn || run || saveState === "saving") return;
    let current = true;
    setBoardError("");
    post<RushBoard>({ action: "rushBoard" }).then(data => {
      if (current) setBoard(data);
    }).catch(error => {
      if (!current) return;
      if (error instanceof RequestError && error.status === 401) setSignedIn(false);
      else setBoardError("Could not load the Rush leaderboard.");
    });
    return () => { current = false; };
  }, [signedIn, run, saveState, boardRevision]);

  async function start(guest = !signedIn) {
    if (starting) return;
    setStarting(true);
    setStartError("");
    try {
      let next: RushRun;
      if (guest) {
        const response = await fetch("/api/rush", { cache: "no-store" });
        if (!response.ok) throw Error("Could not load Rush questions.");
        next = await response.json();
      } else {
        next = await post<RushRun>({ action: "rushStart" });
      }
      setFinished(null);
      setSaveState(null);
      setRun({ ...next, started: performance.now() });
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) {
        setSignedIn(false);
        setStartError("Sign in again to play for a rank, or start a guest run.");
      } else {
        setStartError(guest ? "Could not load Rush questions. Try again." : "Could not start a ranked run. Try again or play as a guest.");
      }
    } finally {
      setStarting(false);
    }
  }

  async function save(result: FinishedRun) {
    setSaveState("saving");
    try {
      const saved = await post<RushResult>({ action: "rushFinish", run: result.runId, answers: result.answers });
      setFinished({ ...result, ...saved });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function finish(result: FinishedRun) {
    setRun(null);
    setFinished(result);
    if (result.ranked) void save(result);
  }

  return (
    <main className="mt-shell rush-shell">
      <div className="rush-layout">
        <header className="rush-header">
          <Link href="/">← Game modes</Link>
          <h1>Rush</h1>
        </header>
        {run ? <Play key={run.pack.set} run={run} onFinish={finish} /> : <>
          <section className="rush-card rush-intro" aria-label={finished ? "Run results" : "Start Rush"}>
            {finished ? <>
              <h2>Rush complete</h2>
              <div className="rush-results" aria-live="polite">
                <div><strong>{finished.score}/{rushLength}</strong><span>Correct</span></div>
                <div><strong>{formatRunTime(finished.elapsedMs)}</strong><span>Time</span></div>
              </div>
              <p role="status">{saveState === "saving" ? "Saving your score…" : saveState === "saved" ? "Score saved to the leaderboard." :
                saveState === "error" ? "Your score could not be saved. You can retry below." : "Guest run"}</p>
              {saveState === "error" && <button type="button" onClick={() => void save(finished)}>Retry saving</button>}
            </> : <>
              <h2>{rushLength} random questions</h2>
              <p>Play a mix from the Grade 6–8 curriculum. You get one scored answer per question and can skip any question.</p>
            </>}
            <div className="rush-actions">
              <button className="mt-primary" type="button" disabled={starting || saveState === "saving"}
                onClick={() => void start()}>
                {starting ? "Loading questions…" : finished ? "Play again" : "Start Rush"}
              </button>
              {startError && signedIn && <button type="button" disabled={starting} onClick={() => void start(true)}>Play as guest</button>}
            </div>
            {startError && <p role="alert">{startError}</p>}
          </section>
          <section className="rush-card rush-leaderboard" aria-labelledby="rush-leaderboard">
            <h2 id="rush-leaderboard">Rush leaderboard</h2>
            <p>Most correct answers first. Fastest time breaks ties.</p>
            {!rankingEnabled ? <p>Ranked play is unavailable here.</p> :
              !signedIn ? <SignIn onSuccess={() => setSignedIn(true)} /> :
              boardError ? <div><p role="alert">{boardError}</p>
                <button type="button" onClick={() => setBoardRevision(revision => revision + 1)}>Retry loading scores</button></div> :
              !board ? <p role="status">Loading scores…</p> :
              !board.records.length ? <p>No ranked runs yet. Finish a run to set the first score.</p> :
              <table className="mt-leaderboard" aria-label="Rush rankings">
                <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Correct</th><th scope="col">Time</th></tr></thead>
                <tbody>{board.records.map(record => <tr key={record.username} className={record.username === board.username ? "mt-own-record" : undefined}>
                  <td>#{record.rank}</td>
                  <th scope="row">{record.username}{record.username === board.username && " (you)"}</th>
                  <td>{record.score}/{rushLength}</td><td>{formatRunTime(record.elapsedMs)}</td>
                </tr>)}</tbody>
              </table>}
          </section>
        </>}
      </div>
    </main>
  );
}

function SignIn({ onSuccess }: { onSuccess: () => void }) {
  const [show, setShow] = useState(false);
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post({ action: "login", ...credentials, create: false });
      onSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return <>
    <p>Sign in with your 7math player account to see scores and rank on your next run.</p>
    {show ? <form className="rush-sign-in" onSubmit={signIn}>
      <PlayerFields value={credentials} onChange={setCredentials} create={false} />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form> : <button type="button" onClick={() => setShow(true)}>Sign in</button>}
  </>;
}

function Play({ run, onFinish }: { run: ActiveRun; onFinish: (result: FinishedRun) => void }) {
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const position = answers.length;

  function advance(raw: string | null, outcome?: Outcome) {
    const next = [...answers, raw];
    const total = score + (outcome === "correct" ? 1 : 0);
    if (next.length === rushLength) {
      onFinish({ runId: run.pack.set, answers: next, score: total, ranked: run.ranked,
        elapsedMs: Math.round(performance.now() - run.started) });
      return;
    }
    setScore(total);
    setAnswers(next);
    setFeedback(raw === null ? "Previous question skipped." : outcome === "correct" ? "Correct." : "Incorrect.");
  }

  return <section className="rush-card rush-play" aria-label="Rush questions">
    <div className="rush-progress">
      <label htmlFor="rush-progress">Question {position + 1} of {rushLength}</label>
      <progress id="rush-progress" value={position} max={rushLength} />
    </div>
    <Question key={position} run={run} position={position} advance={advance} />
    <p className="rush-feedback" role="status">{feedback}</p>
  </section>;
}

function Question({ run, position, advance }: {
  run: ActiveRun; position: number; advance: (raw: string | null, outcome?: Outcome) => void;
}) {
  const question = run.pack.questions[position];
  const [checking, setChecking] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function answer(raw: string) {
    if (locked.current) return;
    locked.current = true;
    setChecking(true);
    try {
      const outcome = await checkLocally(run.pack, position, raw);
      if (outcome !== "simplification") {
        advance(raw, outcome);
        return;
      }
      setError("Equivalent fraction. Simplify your answer.");
    } catch {
      setError("Could not check your answer. Try again.");
    }
    setAttempt(value => value + 1);
    setChecking(false);
    locked.current = false;
  }

  return <>
    <h2 ref={heading} tabIndex={-1}>{question.prompt}</h2>
    <Visual data={question.visual} onSimulated={() => setSimulated(true)} />
    <div className="rush-answer">
      <Answer key={attempt} control={question.control}
        disabled={checking || (question.visual?.kind === "simulation" && !simulated)} onAnswer={answer} />
    </div>
    {error && <p role="alert">{error}</p>}
    <button className="rush-skip" type="button" disabled={checking} onClick={() => {
      if (locked.current) return;
      locked.current = true;
      advance(null);
    }}>Skip question</button>
  </>;
}
