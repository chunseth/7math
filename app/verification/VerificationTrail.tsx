"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { post, RequestError } from "../../lib/mentalist/client";
import { isFieldAttempt, type Outcome } from "../../lib/mentalist/model";
import { studentPrompt } from "../../lib/mentalist/least-order";
import { countReviews, nextReview, type ReviewCase, type ReviewDecision, type ReviewSet } from "../../lib/verification/model";
import Answer from "../mentalist/components/Answer";
import QuestionPrompt, { useQuestionPart } from "../mentalist/components/QuestionPrompt";
import { Visual } from "../mentalist/components/Visual";
import ExportReports from "./ExportReports";

export default function VerificationTrail({ set, initial }: {
  set: ReviewSet;
  initial: Record<string, ReviewDecision>;
}) {
  const [decisions, setDecisions] = useState(initial);
  const current = nextReview(set, decisions);
  const counts = countReviews(set, decisions);
  const finished = counts.accepted + counts.flagged + counts.skipped;
  const review = useRef<HTMLElement>(null);
  const completion = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    review.current?.scrollTo(0, 0);
    if (!current) {
      completion.current?.focus({ preventScroll: true });
    }
  }, [current]);

  return <main ref={review} className="mt-shell verify-home">
    <header className="verify-header">
      <Link href="/">← Main menu</Link>
      <ExportReports setId={set.id} />
    </header>
    <h1>Verification</h1>
    <div className="verify-summary" aria-live="polite">
      <strong>{finished} of {counts.total} completed</strong>
      <p>{counts.accepted} accepted · {counts.flagged} flagged · {counts.skipped} skipped</p>
    </div>
    <progress className="verify-progress" value={finished} max={counts.total} aria-label="Review progress" />
    {current
      ? <CaseReview key={current.id} setId={set.id} item={current} position={set.cases.indexOf(current) + 1} total={counts.total}
        onSaved={decision => setDecisions(previous => ({ ...previous, [decision.id]: decision }))} />
      : <h2 className="verify-complete" tabIndex={-1} ref={completion}>Review complete</h2>}
  </main>;
}

function CaseReview({ setId, item, position, total, onSaved }: {
  setId: string;
  item: ReviewCase;
  position: number;
  total: number;
  onSaved: (decision: ReviewDecision) => void;
}) {
  const { question } = item;
  const { partTitle, setPartTitle } = useQuestionPart(question);
  const [raw, setRaw] = useState<string | null>(null);
  const [reduce, setReduce] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [simulated, setSimulated] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [expired, setExpired] = useState(false);
  const locked = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const reportField = useRef<HTMLTextAreaElement>(null);
  const decisionHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (reporting) reportField.current?.focus();
    else if (raw !== null) decisionHeading.current?.focus();
  }, [reporting, raw]);

  const context = { setId, example: item.id };

  function showError(error: unknown) {
    setMessage(error instanceof Error ? error.message : "Could not complete the request. Try again.");
    if (error instanceof RequestError) {
      if (error.status === 401) setExpired(true);
      if (error.status === 409) setMessage("The review set has changed. Reload to see your progress.");
    }
  }

  async function check(value: string, calculated = false) {
    if (locked.current || raw !== null || reporting) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      const { outcome } = await post<{ outcome: Outcome }>({ action: "verificationCheck", ...context, raw: value });
      if (calculated && outcome !== "correct") return;
      if (outcome === "correct") setRaw(value);
      else {
        if (outcome === "simplification") setReduce(value);
        setMessage(isFieldAttempt(value) ? "" : outcome === "simplification" ? "Equivalent fraction. Simplify your answer." : "Try again.");
        if (!isFieldAttempt(value)) setAttempt(value => value + 1);
      }
    } catch (error) {
      showError(error);
      setAttempt(value => value + 1);
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }

  async function save(status: ReviewDecision["status"]) {
    if (locked.current || (status === "accepted" && raw === null)) return;
    if (status === "flagged" && !note.trim()) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      const saved = await post<ReviewDecision>({ action: "verificationSave", ...context, status, raw, note });
      onSaved(saved);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }

  return <>
    <p className="verify-location">Question {position} of {total}</p>
    <section className="verify-question" aria-labelledby="verification-question">
      <h2 id="verification-question" ref={heading} tabIndex={-1}>
        <QuestionPrompt part={partTitle} text={reduce && raw === null ? `Reduce ${reduce}.` : studentPrompt(question)} />
      </h2>
      <Visual data={question.visual} showLoan={false} onSimulated={() => setSimulated(true)} />
      <Answer key={question.visual?.kind === "loan" ? "loan" : attempt} question={question}
        disabled={busy || reporting || raw !== null || (question.visual?.kind === "simulation" && !question.visual.coinTrials && !simulated)}
        onAnswer={check} onPart={setPartTitle} />
    </section>
    <section className="verify-decision" aria-label="Review decision">
      {raw !== null && <h2 tabIndex={-1} ref={decisionHeading}>Correct</h2>}
      {!reporting && <div className="verify-actions">
        {raw !== null && <button className="mt-primary" type="button" disabled={busy} onClick={() => void save("accepted")}>Accept problem</button>}
        <button type="button" disabled={busy} onClick={() => { setMessage(""); setReporting(true); }}>Report a bug</button>
        <button type="button" disabled={busy} onClick={() => void save("skipped")}>Skip question</button>
      </div>}
      {reporting && <form className="verify-report" onSubmit={event => { event.preventDefault(); void save("flagged"); }}>
        <label htmlFor="verification-note">Describe the bug</label>
        <textarea ref={reportField} id="verification-note" required maxLength={1500} rows={4} disabled={busy}
          value={note} onChange={event => setNote(event.target.value)} />
        <div className="verify-actions">
          <button className="mt-primary" disabled={busy || !note.trim()}>Save bug report</button>
          <button type="button" disabled={busy} onClick={() => { setReporting(false); setMessage(""); }}>Cancel</button>
        </div>
      </form>}
      {message && <p className="verify-message" role="status">{message}</p>}
      {expired && <a href="/verification/sign-in">Sign in again</a>}
    </section>
  </>;
}
