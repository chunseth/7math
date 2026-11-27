"use client";
import { useEffect, useRef, useState } from "react";
import Answer from "../mentalist/components/Answer";
import { Visual } from "../mentalist/components/Visual";
import { checkLocally, guestOrder, type LevelPack } from "../../lib/mentalist/round";
import { studentPrompt } from "../../lib/mentalist/least-order";
import QuestionPrompt, { useQuestionPart } from "../mentalist/components/QuestionPrompt";
import { gradeOf, isFieldAttempt, levelById } from "../../lib/mentalist/model";

export function Practice({ level, close }: { level: string; close: () => void }) {
  const [pack, setPack] = useState<LevelPack | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [position, setPosition] = useState(0);
  const [misses, setMisses] = useState(new Set<number>());
  const [feedback, setFeedback] = useState("");
  const [reduce, setReduce] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [retry, setRetry] = useState(0);
  const [half, setHalf] = useState(1);
  const [simulated, setSimulated] = useState(-1);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setFeedback("");
    async function load() {
      const response = await fetch(`/${gradeOf(level)}math/practice/${level}.json`, {signal: controller.signal});
      if (!response.ok) throw Error("Load failed");
      const data: LevelPack = await response.json();
      const indices = guestOrder(data);
      if (!controller.signal.aborted) { setOrder(indices); setPack(data); }
    }
    void load().catch(() => { if (!controller.signal.aborted) setFeedback("Could not load practice questions."); });
    return () => controller.abort();
  }, [level,retry]);
  const done = position === 12 * half;
  const question = pack?.questions[order[position]];
  const { partTitle, setPartTitle } = useQuestionPart(question);
  async function answer(raw: string, calculated = false) {
    if (!pack || lock.current || done) return;
    lock.current = true;
    try {
      const outcome = await checkLocally(pack, order[position], raw);
      if (calculated && outcome !== "correct") return;
      if (outcome === "correct") { setPosition(position + 1); setFeedback(""); setReduce(""); }
      else {
        if (outcome === "incorrect") setMisses(new Set([...misses,position]));
        if (outcome === "simplification") setReduce(raw);
        setFeedback(isFieldAttempt(raw) ? "" : outcome === "incorrect" ? "Try again." : "Equivalent fraction. Simplify your answer.");
        if (!isFieldAttempt(raw)) setAttempt(a => a + 1);
      }
    } catch { setFeedback("Could not check this answer. Try again."); setAttempt(a => a + 1); }
    finally { lock.current = false; }
  }
  return <main className="mt-shell mt-panel g8-practice">
    <button onClick={close}>Back to curriculum</button>
    <h1>{levelById.get(level)?.title}</h1>
    {done ? <><h2>Practice complete</h2><p>{position - misses.size} of {position} correct on the first try.</p>
      {half === 1 && <button className="mt-primary" onClick={() => setHalf(2)}>Practice the remaining 12</button>}</> :
      question ? <><p>Practice · {position % 12 + 1} of 12</p><h2><QuestionPrompt part={partTitle} text={reduce ? `Reduce ${reduce}.` : studentPrompt(question)} /></h2>
        <Visual key={position} data={question.visual} showLoan={false} onSimulated={() => setSimulated(position)} />
        <Answer key={position + "/" + (question.visual?.kind === "loan" ? 0 : attempt)} question={question}
          disabled={question.visual?.kind === "simulation" && !question.visual.coinTrials && simulated !== position} onAnswer={answer} onPart={setPartTitle} /></> :
      feedback ? <button onClick={() => setRetry(retry+1)}>Retry loading</button> : <p>Loading questions…</p>}
    <p role="status">{feedback}</p>
  </main>;
}
