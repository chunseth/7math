"use client";

import { useEffect, useState } from "react";
import { complete, hasSequentialFields, type Question } from "../../../lib/mentalist/model";
import { calculatorSettings } from "../../../lib/mentalist/calculator";
import { leastOrder } from "../../../lib/mentalist/least-order";
import { hasWhiteboard } from "../../../lib/mentalist/presentation";
import { responseUnit } from "../../../lib/mentalist/units";
import { LoanCalculator } from "../../8math/Models";
import Coordinate from "./Coordinate";
import QuestionCalculator from "./QuestionCalculator";
import NumericEntry from "./NumericEntry";
import StructuredAnswer from "./StructuredAnswer";
import DisplayAnswer from "./DisplayAnswer";
import Whiteboard from "./Whiteboard";
import LeastOrderBubbles from "./LeastOrderBubbles";
import CoinTrial from "./CoinTrial";

export default function Answer({ question, disabled, onAnswer }: {
  question: Question;
  disabled: boolean;
  onAnswer: (raw: string, calculated?: boolean) => void;
}) {
  const [visible, setVisible] = useState(true);
  const [points, setPoints] = useState("");
  const { control, prompt, visual } = question;
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const locked = disabled || !visible;
  const unit = responseUnit(question);
  const calculator = calculatorSettings(prompt, control);
  const order = leastOrder(question);
  if (visual?.coinTrials) return <CoinTrial question={question} trials={visual.coinTrials} disabled={locked} onAnswer={onAnswer} />;
  if (visual?.kind === "loan") return <LoanCalculator values={visual.values!} disabled={locked} onAnswer={value => {
    if (!locked && complete(control, value)) onAnswer(value, true);
  }} />;
  if (order) return <LeastOrderBubbles options={control.options!} order={order} disabled={locked} onAnswer={onAnswer} />;
  if (control.options) return <div className="mt-options">
    {control.options.map(option => <button type="button" key={option} disabled={locked} onClick={() => onAnswer(option)}>
      {option}{unit && /^-?[\d./]+$/.test(option) ? " " + unit : ""}
    </button>)}
  </div>;
  if (hasSequentialFields(control)) return <StructuredAnswer question={question} disabled={locked} onAnswer={onAnswer} />;
  if (control.fields) return <DisplayAnswer question={question} disabled={locked} onAnswer={onAnswer} />;
  if (control.limit) {
    const scatter = control.kind === "scatterplot";
    return <>
      <Coordinate step={control.step ?? 1} origin={control.origin ?? 0} scatter={scatter}
        count={control.points ?? 1} limit={control.limit} line={control.kind === "line"}
        drawing={control.kind === "drawing"} drawingScale={control.kind === "drawing" ? Number(/\bat (\d+) m per square/.exec(prompt)?.[1] ?? 1) : 1}
        disabled={locked} onPick={raw => { if (scatter) setPoints(raw); else if (complete(control, raw)) onAnswer(raw); }} />
      {scatter && <button type="button" disabled={locked || !complete(control, points)} onClick={() => onAnswer(points)}>Check plot</button>}
    </>;
  }
  if (calculator) return <QuestionCalculator pi={calculator.pi} control={control} unit={unit}
    disabled={locked} onResult={raw => onAnswer(raw, true)} />;
  return <>
    {hasWhiteboard(prompt) && <Whiteboard />}
    <NumericEntry control={control} unit={unit} disabled={locked} onAnswer={onAnswer} />
  </>;
}
