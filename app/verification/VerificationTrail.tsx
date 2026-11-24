"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { post, RequestError } from "../../lib/mentalist/client";
import { levelById, type Outcome } from "../../lib/mentalist/model";
import {
  countReviews, reviewCases, verificationGrades, verificationWorlds,
  type ReviewCase, type ReviewDecision, type ReviewWorld,
} from "../../lib/verification/model";
import Answer from "../mentalist/components/Answer";
import { LessonVideo } from "../mentalist/components/PreviewFeed";
import { Visual } from "../mentalist/components/Visual";
import ExportReports from "./ExportReports";

export default function VerificationTrail({ world, initial }: {
  world: ReviewWorld;
  initial: Record<string, ReviewDecision>;
}) {
  const [decisions, setDecisions] = useState(initial);
  const [opened, setOpened] = useState<string | null>(null);
  const examples = reviewCases(world);
  const next = examples.find(item => !decisions[item.id]);
  const current = examples.find(item => item.id === opened);
  const counts = countReviews(world, decisions);
  const reviewed = counts.accepted + counts.flagged;
  const theme = verificationWorlds[world.grade];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [opened]);

  function saved(decision: ReviewDecision) {
    const after = { ...decisions, [decision.id]: decision };
    setDecisions(after);
    setOpened(examples.find(item => !after[item.id])?.id ?? null);
  }

  const title = `${world.grade}math · ${theme.name}`;
  return <main className={`mt-shell verify-home verify-world-${world.grade}`}>
    <header className="verify-header">
      <Link href="/verification">← Worlds</Link>
      {current
        ? <button type="button" onClick={() => setOpened(null)}>World map</button>
        : <ExportReports />}
    </header>
    {current ? <CaseReview key={current.id} world={world} item={current}
      position={examples.indexOf(current) + 1} total={counts.total}
      decision={decisions[current.id]} onSaved={saved} /> : <>
      <nav className="verify-grade-nav" aria-label="Change verification world">
        {verificationGrades.map(grade => <Link key={grade} href={`/verification/${grade}`}
          aria-current={grade === world.grade ? "page" : undefined}>{grade}math</Link>)}
      </nav>
      <div className="verify-world-banner">
        <img src={`/sprites/${theme.sprite}.png`} alt="" width="92" height="92" />
        <div>
          <h1>{title}</h1>
          <p>{theme.focus}</p>
        </div>
      </div>
      <div className="verify-summary">
        <div>
          <strong>{reviewed} of {counts.total} reviewed</strong>
          <p>{counts.accepted} accepted · {counts.flagged} flagged for follow-up</p>
        </div>
        {next && <button className="mt-primary" type="button" onClick={() => setOpened(next.id)}>
          {reviewed ? "Continue review" : "Start review"}
        </button>}
      </div>
      <progress className="verify-progress" value={reviewed} max={counts.total} aria-label="World progress" />
      {!next && <p className="verify-complete" role="status">
        ★ World review complete. {counts.flagged > 0 ? "Export your bug reports for follow-up." : "All examples accepted."}
      </p>}
      <div className="verify-map" aria-label={`${title} checkpoints`}>
        {world.chapters.map(chapter => <section key={chapter.title}>
          <h2>{chapter.title}</h2>
          <ol>
            {chapter.checkpoints.map(checkpoint => {
              const done = checkpoint.cases.filter(item => decisions[item.id]).length;
              const complete = done === checkpoint.cases.length;
              const flagged = checkpoint.cases.filter(item => decisions[item.id]?.status === "flagged").length;
              const active = checkpoint.cases.find(item => item.id === next?.id);
              const target = active ?? checkpoint.cases[0];
              const available = complete || !!active;
              const first = examples.indexOf(checkpoint.cases[0]) + 1;
              return <li key={checkpoint.title}>
                <button className="verify-stop" type="button" disabled={!available}
                  aria-current={active ? "step" : undefined} onClick={() => setOpened(target.id)}>
                  <span aria-hidden="true" className="verify-marker">{complete ? (flagged ? "⚑" : "✓") : first}</span>
                  <span><strong>{checkpoint.title}</strong>
                    <small>{complete ? "Reviewed" : active ? "Available" : "Locked"} · {done}/{checkpoint.cases.length} examples{flagged > 0 && ` · ${flagged} flagged`}</small>
                  </span>
                </button>
                {done > 0 && <div className="verify-reviewed">
                  {checkpoint.cases.map((item, i) => decisions[item.id] &&
                    <button type="button" key={item.id} onClick={() => setOpened(item.id)}
                      aria-label={`Review ${checkpoint.title}, example ${i + 1}, ${decisions[item.id].status}`}>
                      <span aria-hidden="true">{decisions[item.id].status === "accepted" ? "✓" : "⚑"}</span> {i + 1}
                    </button>)}
                </div>}
              </li>;
            })}
          </ol>
        </section>)}
      </div>
    </>}
  </main>;
}

function CaseReview({ world, item, position, total, decision, onSaved }: {
  world: ReviewWorld;
  item: ReviewCase;
  position: number;
  total: number;
  decision?: ReviewDecision;
  onSaved: (decision: ReviewDecision) => void;
}) {
  const { question } = item;
  const [raw, setRaw] = useState<string | null>(null);
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

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (reporting) reportField.current?.focus();
    else if (raw !== null) decisionHeading.current?.focus();
  }, [reporting, raw]);

  const context = { grade: world.grade, version: world.version, example: item.id };

  function showError(error: unknown) {
    setMessage(error instanceof Error ? error.message : "Could not complete the request. Try again.");
    if (error instanceof RequestError) {
      if (error.status === 401) setExpired(true);
      if (error.status === 409) setMessage("The trail has changed. Reload to see your current progress.");
    }
  }

  async function check(value: string) {
    if (locked.current || raw !== null || reporting || decision) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      const { outcome } = await post<{ outcome: Outcome }>({ action: "verificationCheck", ...context, raw: value });
      if (outcome === "correct") setRaw(value);
      else {
        setMessage(outcome === "simplification" ? "Simplify your fraction." : "Try again.");
        setAttempt(value => value + 1);
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
    if (locked.current || decision || (status === "accepted" && raw === null)) return;
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
    <p className="verify-location">Grade {world.grade} · Example {position} of {total}</p>
    <div className="verify-encounter">
      <section className="verify-question" aria-labelledby="verification-question">
        <p>{levelById.get(item.level)?.title ?? item.level}</p>
        <h1 id="verification-question" ref={heading} tabIndex={-1}>{question.prompt}</h1>
        <Visual data={question.visual} onSimulated={() => setSimulated(true)} />
        {!decision && <Answer key={attempt} control={question.control} prompt={question.prompt}
          disabled={busy || reporting || raw !== null || (question.visual?.kind === "simulation" && !simulated)}
          onAnswer={value => void check(value)} />}
      </section>
      <aside className="verify-note" aria-label="Reviewer note">
        <h2>What to look for</h2>
        <p>{item.note}</p>
        {item.workedExample && <LessonVideo level={item.level} />}
        <p className="verify-identifiers"><span>{item.level}</span><span>{item.questionId}</span></p>
      </aside>
    </div>
    {decision ? <section className="verify-decision" aria-label="Saved review">
      <h2>{decision.status === "accepted" ? "✓ Accepted" : "⚑ Bug reported"}</h2>
      {decision.note && <p className="verify-saved-note">{decision.note}</p>}
    </section> : <>
      {raw !== null && <section className="verify-decision" aria-label="Review decision">
        <h2 tabIndex={-1} ref={decisionHeading}>Correct. Review this problem.</h2>
        {!reporting && <div className="verify-actions">
          <button className="mt-primary" type="button" disabled={busy} onClick={() => void save("accepted")}>Accept problem</button>
          <button type="button" disabled={busy} onClick={() => { setMessage(""); setReporting(true); }}>Report a bug</button>
        </div>}
      </section>}
      {raw === null && !reporting && <button className="verify-blocked" type="button" disabled={busy}
        onClick={() => { setMessage(""); setReporting(true); }}>Can’t answer because of a bug</button>}
      {reporting && <form className="verify-report" onSubmit={event => { event.preventDefault(); void save("flagged"); }}>
        <label htmlFor="verification-note">What is wrong with this problem?</label>
        <textarea ref={reportField} id="verification-note" required maxLength={1500} rows={4} disabled={busy}
          value={note} onChange={event => setNote(event.target.value)}
          placeholder="Describe what you expected and what happened." />
        <div className="verify-actions">
          <button className="mt-primary" disabled={busy || !note.trim()}>Save bug report</button>
          <button type="button" disabled={busy} onClick={() => { setReporting(false); setMessage(""); }}>Cancel</button>
        </div>
      </form>}
      {message && <p className="verify-message" role="status">{message}</p>}
      {expired && <a href={`/verification/${world.grade}`}>Sign in again</a>}
    </>}
  </>;
}
