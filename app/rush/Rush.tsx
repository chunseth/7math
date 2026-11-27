"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { post, RequestError } from "../../lib/mentalist/client";
import { formatRunTime, type Outcome } from "../../lib/mentalist/model";
import { checkLocally } from "../../lib/mentalist/round";
import { studentPrompt } from "../../lib/mentalist/least-order";
import QuestionPrompt, { useQuestionPart } from "../mentalist/components/QuestionPrompt";
import { rushLength, type RushBoard, type RushGrade, type RushResult, type RushRun, type RushSaved } from "../../lib/rush/model";
import Answer from "../mentalist/components/Answer";
import { emptyCredentials, PlayerFields } from "../mentalist/components/PlayerFields";
import { Visual } from "../mentalist/components/Visual";
import { GradeMenu, Leaderboard } from "./GradeMenu";

type ActiveRun = RushRun & { started: number };
type FinishedRun = RushResult & { runId: string; answers: (string | null)[] };
type RushFeedback = Exclude<Outcome, "simplification">;

export default function Rush({ available, hasSession }: { available: boolean; hasSession: boolean }) {
  const [signedIn, setSignedIn] = useState(hasSession);
  const [grade, setGrade] = useState<RushGrade>(7);
  const [boardGrade, setBoardGrade] = useState<RushGrade | null>(null);
  const [boards, setBoards] = useState<Partial<Record<RushGrade, RushBoard>>>({});
  const [boardStatus, setBoardStatus] = useState<"loading" | "error" | "expired" | "ready">("loading");
  const [boardRevision, setBoardRevision] = useState(0);
  const boardTrigger = useRef<HTMLButtonElement>(null);
  const [flash, setFlash] = useState<{ step: number; outcome: RushFeedback } | null>(null);
  const [run, setRun] = useState<ActiveRun | null>(null);
  const activeRunId = useRef<string | null>(null);
  const [finished, setFinished] = useState<FinishedRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error" | null>(null);

  const requireSignIn = useCallback(() => {
    setBoardGrade(null);
    setBoards({});
    setBoardStatus("loading");
    setSignedIn(false);
  }, []);

  useEffect(() => {
    if (!available || !signedIn) return;
    let active = true;
    post<RushBoard[]>({ action: "rushBoards" }).then(data => {
      if (!active) return;
      setBoards(current => {
        const preloaded = Object.fromEntries(data.map(board => [board.grade, board]));
        return { ...preloaded, ...current };
      });
      setBoardStatus("ready");
    }).catch(error => {
      if (active) setBoardStatus(error instanceof RequestError && error.status === 401 ? "expired" : "error");
    });
    return () => { active = false; };
  }, [available, signedIn, boardRevision]);

  function openBoard(selected: RushGrade, trigger: HTMLButtonElement) {
    boardTrigger.current = trigger;
    setBoardGrade(selected);
  }

  function closeBoard() {
    setBoardGrade(null);
    requestAnimationFrame(() => boardTrigger.current?.focus({ preventScroll: true }));
  }

  async function start(selectedGrade: RushGrade) {
    if (starting || !signedIn) return;
    setGrade(selectedGrade);
    setStarting(true);
    setStartError("");
    try {
      const next = await post<RushRun>({ action: "rushStart", grade: selectedGrade });
      setFinished(null);
      setSaveState(null);
      setFlash(null);
      activeRunId.current = next.pack.set;
      setRun({ ...next, started: performance.now() });
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) requireSignIn();
      else setStartError("Could not start Rush. Try again.");
    } finally {
      setStarting(false);
    }
  }

  async function save(result: FinishedRun) {
    setSaveState("saving");
    try {
      const { board, ...saved } = await post<RushSaved>({ action: "rushFinish", run: result.runId, answers: result.answers });
      if (board) setBoards(current => ({ ...current, [board.grade]: board }));
      setFinished({ ...result, ...saved });
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      if (error instanceof RequestError && error.status === 401) requireSignIn();
    }
  }

  function finish(result: FinishedRun) {
    if (activeRunId.current !== result.runId) return;
    activeRunId.current = null;
    setRun(null);
    setFinished(result);
    void save(result);
  }

  function leaveRun(current: ActiveRun) {
    activeRunId.current = null;
    setGrade(current.grade);
    setFlash(null);
    setRun(null);
  }

  return (
    <main className="mt-shell rush-shell">
      {flash && <div key={flash.step} className={`rush-border-glow rush-border-${flash.outcome}`} aria-hidden="true" />}
      <div className="rush-layout" inert={boardGrade !== null}>
        <header className="mt-top rush-header">
          {run ? <button className="rush-back" type="button" aria-label={`Back to ${run.grade}math Rush menu`}
            onClick={() => leaveRun(run)}>‹</button> :
            <Link className="rush-back" href="/" aria-label="Main menu">‹</Link>}
          <h1>{run ? `${run.grade}math Rush` : "Rush"}</h1>
        </header>
        {!available ? <p role="alert">Rush is currently unavailable.</p> :
          !signedIn ? <AccountGate onSuccess={() => setSignedIn(true)} /> :
          run ? <Play key={run.pack.set} run={run} onFinish={finish}
            onFeedback={(step, outcome) => {
              if (activeRunId.current === run.pack.set) setFlash({ step, outcome });
            }} /> :
          finished ? <section className="rush-theme rush-summary" data-grade={grade} aria-labelledby="rush-result-title">
            <h2 className="rush-grade-title" id="rush-result-title">{grade}math Rush complete</h2>
            <div className="rush-results" aria-live="polite">
              <div><span>Score</span><strong>{finished.score}/{rushLength}</strong></div>
              <div><span>Time</span><strong>{formatRunTime(finished.elapsedMs)}</strong></div>
            </div>
            <p role="status">{saveState === "saving" ? "Saving your score…" : saveState === "saved" ? "Score saved." : "Could not save your score."}</p>
            {startError && <p role="alert">{startError}</p>}
            <div className="rush-actions">
              <button className="rush-action" type="button" disabled={starting || saveState !== "saved"}
                aria-haspopup="dialog" onClick={event => openBoard(grade, event.currentTarget)}>View score on leaderboard</button>
              <button type="button" disabled={starting || saveState === "saving"} onClick={() => void start(grade)}>Play again</button>
              {saveState === "error" && <button type="button" disabled={starting} onClick={() => void save(finished)}>Retry saving</button>}
              <button type="button" disabled={starting || saveState === "saving"} onClick={() => {
                setFinished(null);
                setFlash(null);
                setStartError("");
              }}>Back to grades</button>
            </div>
          </section> :
          <GradeMenu grade={grade} starting={starting} onGrade={setGrade} onStart={start} onBoard={openBoard} />}
        {startError && !finished && <p role="alert">{startError}</p>}
      </div>
      {signedIn && boardGrade && <Leaderboard key={boardGrade} grade={boardGrade} board={boards[boardGrade]}
        status={boardStatus} result={finished && grade === boardGrade && saveState === "saved" ? finished : null}
        close={closeBoard} onAuthRequired={requireSignIn} retry={() => {
          setBoardStatus("loading");
          setBoardRevision(value => value + 1);
        }} />}
    </main>
  );
}

function AccountGate({ onSuccess }: { onSuccess: () => void }) {
  const [create, setCreate] = useState(false);
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await post({ action: "login", ...credentials, create });
      onSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return <section className="rush-card rush-account" aria-labelledby="rush-account-title">
    <h2 id="rush-account-title">{create ? "Create a player" : "Sign in to Rush"}</h2>
    <form onSubmit={submit}>
      <fieldset className="rush-account-fields" disabled={busy}>
        <PlayerFields value={credentials} onChange={setCredentials} create={create} />
        <button className="rush-action" type="submit">{busy ? (create ? "Creating player…" : "Signing in…") : create ? "Create player" : "Sign in"}</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
    <button type="button" disabled={busy} onClick={() => {
      setCreate(!create);
      setError("");
    }}>{create ? "Sign in instead" : "Create a player"}</button>
  </section>;
}

function Play({ run, onFinish, onFeedback }: {
  run: ActiveRun;
  onFinish: (result: FinishedRun) => void;
  onFeedback: (step: number, outcome: RushFeedback) => void;
}) {
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [score, setScore] = useState(0);
  const position = answers.length;

  function advance(raw: string | null, outcome: RushFeedback) {
    const next = [...answers, raw];
    const total = score + (outcome === "correct" ? 1 : 0);
    onFeedback(next.length, outcome);
    if (next.length === rushLength) {
      onFinish({ runId: run.pack.set, answers: next, score: total,
        elapsedMs: Math.round(performance.now() - run.started) });
      return;
    }
    setScore(total);
    setAnswers(next);
  }

  return <section className="rush-card rush-play" aria-label="Rush questions">
    <div className="rush-progress">
      <label htmlFor="rush-progress">Question {position + 1} of {rushLength}</label>
      <progress id="rush-progress" value={position} max={rushLength} />
    </div>
    <Question key={position} run={run} position={position} advance={advance} />
  </section>;
}

function Question({ run, position, advance }: {
  run: ActiveRun; position: number; advance: (raw: string | null, outcome: RushFeedback) => void;
}) {
  const question = run.pack.questions[position];
  const { partTitle, setPartTitle } = useQuestionPart(question);
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
      advance(raw, outcome === "correct" ? "correct" : "incorrect");
      return;
    } catch {
      setError("Could not check your answer. Try again.");
    }
    setAttempt(value => value + 1);
    setChecking(false);
    locked.current = false;
  }

  return <>
    <h2 ref={heading} tabIndex={-1}><QuestionPrompt part={partTitle} text={studentPrompt(question)} /></h2>
    <Visual data={question.visual} showLoan={false} onSimulated={() => setSimulated(true)} />
    <div className="rush-answer">
      <Answer key={question.visual?.kind === "loan" ? "loan" : attempt} question={question} singleAttempt
        disabled={checking || (question.visual?.kind === "simulation" && !question.visual.coinTrials && !simulated)} onAnswer={answer} onPart={setPartTitle} />
    </div>
    {error && <p role="alert">{error}</p>}
    <button className="rush-skip" type="button" disabled={checking} onClick={() => {
      if (locked.current) return;
      locked.current = true;
      advance(null, "incorrect");
    }}>Skip question</button>
  </>;
}
