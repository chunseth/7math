"use client";

import Link from "next/link";
import { useState } from "react";
import NumericAnswerInput from "../components/NumericAnswerInput";
import { branches, concepts, conceptById } from "../../lib/curriculum/catalog";
import { equal, formatRational, parseAnswer } from "../../lib/curriculum/rational";
import { isPlayable, makeNumericProblem, type NumericProblem } from "../../lib/curriculum/templates";
import { supabase } from "../../lib/supabase";

type Feedback = { correct: boolean; text: string };
export default function SkillsPage() {
  const [branch, setBranch] = useState("number");
  const [selectedId, setSelectedId] = useState("number.integer-add");
  const [assigned, setAssigned] = useState<string[] | null>(null);
  const [onlyAssigned, setOnlyAssigned] = useState(false);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [problem, setProblem] = useState<NumericProblem | null>(null);
  const [sequence, setSequence] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState("");
  const [hintUsed, setHintUsed] = useState(false);
  const [score, setScore] = useState({ correct:0, total:0, independent:0 });
  const selected = conceptById.get(selectedId)!;

  function select(id: string) {
    const concept = conceptById.get(id);
    if (!concept) return;
    setSelectedId(id); setBranch(concept.branch); setProblem(null);setFeedback(null);setError("");setAnswer("");setSequence(0);setScore({correct:0,total:0,independent:0});
  }
  function start(nextSequence = 0) {
    setProblem(makeNumericProblem(selectedId,nextSequence)); setSequence(nextSequence);setAnswer("");setFeedback(null);setError("");setHintUsed(false);
  }
  function check(event: React.FormEvent) {
    event.preventDefault();
    if (!problem || feedback) return;
    const parsed = parseAnswer(answer);
    if (!parsed) { setError("Enter a valid number or fraction with a nonzero denominator.");return; }
    const correct = equal(parsed,problem.answer);
    setError("");setFeedback({correct,text:correct ? "Correct!" : `The answer is ${formatRational(problem.answer)}.`});
    setScore((s) => ({correct:s.correct+Number(correct),total:s.total+1,independent:s.independent+Number(correct && !hintUsed)}));
  }
  async function loadAssignments(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || assignmentBusy) return;
    setAssignmentBusy(true);setAssignmentMessage("");setAssigned(null);setOnlyAssigned(false);
    try {
      const {data,error:lookupError} = await supabase.rpc("get_concept_assignments",{player_username:username.trim().toLowerCase(),player_pin:pin});
      if (lookupError) { setAssignmentMessage(lookupError.message.includes("Username or PIN") ? "Username or PIN is incorrect." : "Assignments are unavailable. Your teacher may need to enable skill assignments.");return; }
      setAssigned((data ?? []).map((row) => row.concept_id));setOnlyAssigned(true);
      setAssignmentMessage(data?.length ? "Your assignments are loaded." : "You have no assigned skills. You can explore the catalog.");
    } catch { setAssignmentMessage("Could not load assignments. Please retry."); }
    finally { setAssignmentBusy(false);setPin(""); }
  }
  const visible = concepts.filter((n) => n.branch===branch && (!onlyAssigned || assigned?.includes(n.id)));
  return <main className="curriculum-shell">
    <header className="curriculum-header"><Link href="/">← Main menu</Link><Link href="/teacher">Teacher dashboard</Link></header>
    <h1>Grade 7 skill tree</h1>
    <p>Choose a branch, explore a concept, and start available practice. Suggested preparation helps you choose; it never locks a skill.</p>
    <p className="curriculum-notice">Six concepts have untimed numeric practice. Other missions are planned. Practice scores last for this session and do not award mastery, cards, or coins.</p>
    <details className="curriculum-login"><summary>Find my teacher assignments</summary>
      <form className="curriculum-controls" onSubmit={loadAssignments}>
        <label>Username<input required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={16} /></label>
        <label>Two-digit PIN<input required type="password" inputMode="numeric" pattern="[0-9]{2}" maxLength={2} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} /></label>
        <button disabled={!supabase || assignmentBusy} type="submit">{assignmentBusy ? "Loading…" : "Load assignments"}</button>
      </form>
      {!supabase && <p>Teacher assignments need a connected school account. Open practice is available below.</p>}
      {assignmentMessage && <p role="status">{assignmentMessage}</p>}
    </details>
    {assigned !== null && <div className="curriculum-controls"><label><input type="checkbox" checked={onlyAssigned} onChange={(e) => setOnlyAssigned(e.target.checked)} /> Show my assignments only ({assigned.length})</label><button onClick={() => {setAssigned(null);setOnlyAssigned(false);setUsername("");setAssignmentMessage("");}}>Clear assignments</button></div>}
    <nav className="curriculum-branches" aria-label="Skill branches">{branches.map((b) => <button key={b.id} aria-pressed={branch===b.id} onClick={() => { const first = concepts.find((n) => n.branch===b.id && (!onlyAssigned || assigned?.includes(n.id))); if (first) select(first.id); else {setBranch(b.id);setProblem(null);} }}>{b.title} <span>({concepts.filter((n) => n.branch===b.id && (!onlyAssigned || assigned?.includes(n.id))).length})</span></button>)}</nav>
    <div className="curriculum-layout">
      <section aria-label={`${branch} concepts`} className="curriculum-cards">{visible.map((n) => <button className="curriculum-concept" key={n.id} aria-pressed={selectedId===n.id} onClick={() => select(n.id)}><span>{n.scope === "review" ? "Optional review" : n.teks.join(" · ")}</span><strong>{n.title}</strong><small>{isPlayable(n.id) ? "Numeric practice available" : "Missions planned"}{assigned?.includes(n.id) ? " · Assigned" : ""}</small></button>)}{visible.length===0 && <p>No assignments in this branch. Choose another branch or show the full catalog.</p>}</section>
      <section className="curriculum-detail" aria-labelledby="concept-title" hidden={selected.branch!==branch || (onlyAssigned && !assigned?.includes(selected.id))}>
        <h2 id="concept-title">{selected.title}</h2>
        <p>{selected.scope === "review" ? "Optional foundational review" : `Grade 7 · ${selected.teks.join(", ")}`}</p>
        <h3>Suggested preparation</h3>
        {selected.prerequisites.length ? <ul>{selected.prerequisites.map((id) => <li key={id}><button type="button" className="curriculum-text-button" onClick={() => select(id)}>{conceptById.get(id)!.title}</button></li>)}</ul> : <p>You can start here.</p>}
        <details><summary>Full concept scope</summary><ul>{selected.requiredVariants.map((v) => <li key={v}>{v}</li>)}</ul><p>Available numeric practice covers part of this scope. Models, reasoning, and complete coverage are still being developed.</p></details>
        {!isPlayable(selectedId) ? <p className="curriculum-notice">Practice for this concept is planned. You can explore its scope and preparation now.</p> : !problem ? <button className="curriculum-primary" onClick={() => start()}>Start numeric practice</button> : <div className="curriculum-practice">
          <p aria-live="polite">{score.correct} correct out of {score.total} · {score.independent} correct without hints</p>
          <h3 id="problem-prompt">{problem.prompt}</h3>
          <form onSubmit={check} aria-labelledby="problem-prompt">
            <NumericAnswerInput value={answer} onChange={setAnswer} disabled={Boolean(feedback)} />
            {error && <p role="alert">{error}</p>}
            {!feedback && <div className="curriculum-controls"><button className="curriculum-primary" type="submit">Check answer</button><button type="button" onClick={() => setHintUsed(true)}>Show hint</button></div>}
          </form>
          {hintUsed && <p>{problem.hint}</p>}
          {feedback && <div role="status"><p>{feedback.text}</p>{!feedback.correct && <p>{problem.hint}</p>}<button className="curriculum-primary" onClick={() => start(sequence+1)}>Next problem</button></div>}
        </div>}
      </section>
    </div>
  </main>;
}
