import { useEffect, useRef, useState } from "react";
import { checkField } from "../../../lib/mentalist/round";
import { fieldAttempt, fieldFormat, fieldValue, responseFieldMode, type Question } from "../../../lib/mentalist/model";
import { calculatorSettings } from "../../../lib/mentalist/calculator";
import { fieldUnit } from "../../../lib/mentalist/units";
import NumericEntry from "./NumericEntry";
import QuestionCalculator from "./QuestionCalculator";
import { Visual } from "./Visual";

export default function StructuredAnswer({ question, disabled, onAnswer, onDraft, fieldAnswers, onPart, singleAttempt, fractionDelayMs }: {
  question: Question;
  disabled: boolean;
  onAnswer: (raw: string, calculated?: boolean) => void;
  fieldAnswers?: string[];
  onDraft?: (value: string) => void;
  onPart?: (title: string) => void;
  singleAttempt?: boolean;
  fractionDelayMs?: number;
}) {
  const { control, prompt } = question;
  const fields = control.fields!;
  const [part, setPart] = useState(0);
  const [values, setValues] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const order = control.kind === "boxplot" ? [2, 0, 4, 1, 3] : fields.map((_, i) => i);
  const index = order[part];
  const field = fields[index];
  const unit = field && fieldUnit(question, index);
  const calculator = calculatorSettings(prompt, control);
  const locked = disabled || busy;

  async function submit(value: string) {
    if (locked || pending.current || !field || fieldValue(control, index, value) === null) return;
    pending.current = true;
    setBusy(true);
    setFeedback("");
    try {
      const correct = fieldAnswers ? fieldValue(control, index, value) === fieldAnswers[index]
        : !question.fieldChecks || await checkField(question, index, value);
      if (!correct) {
        if (calculator && !singleAttempt) {
          setFeedback("Try this part again.");
          return;
        }
        setRetry(n => n + 1);
        onAnswer(fieldAttempt(index, value));
        return;
      }
      const next = [...values];
      next[index] = value;
      setValues(next);
      setRetry(0);
      setPart(part + 1);
      if (part + 1 === order.length && control.kind !== "boxplot") onAnswer(next.join("|"));
    } catch {
      setFeedback("Could not check this part. Try again.");
      setRetry(n => n + 1);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const mode = field && responseFieldMode(control.kind, field, index);
  const format = field && (question.fieldFormats?.[index] ?? fieldFormat(control, index, field.options[0]));
  const label = field && (control.kind === "net" && index < 2 ? "Number of " + field.label.toLowerCase() : field.label);
  const partTitle = field ? `Part ${part + 1} of ${order.length} · ${label}` : "";
  useEffect(() => { onPart?.(partTitle); }, [onPart, partTitle]);
  const options = field ? control.kind === "net" && index < 2 ? [...field.options].sort((a, b) => Number(a) - Number(b))
    : control.kind === "ray" && index === 2 ? ["Left", "Right"] : field.options : [];
  const box = control.kind === "boxplot" && values[4] !== undefined;
  return <div className="mt-fields">
    {box && <Visual data={{kind: "boxes", rows: [[0, 1, 2, 3, 4].map(i => values[i] ?? "")], labels: ["Your plot"]}} />}
    {control.kind === "ray" && values[0] &&
      <svg className="mt-chart" viewBox="0 0 240 55" role="img" aria-label={values.filter(Boolean).join(", ")}>
        <path d="M12 25H228" stroke="#a2b8ae" />
        {values[2] && <path d={values[2] === "Right" ? "M120 25H220m-8 -5 8 5-8 5" : "M120 25H20m8 -5 -8 5 8 5"}
          fill="none" stroke="#347758" strokeWidth="3" />}
        <circle cx="120" cy="25" r="5" stroke="#347758" strokeWidth="2" fill={values[1] === "Closed" ? "#347758" : "white"} />
        <text x="120" y="47" textAnchor="middle">{values[0]}</text>
      </svg>
    }
    {control.kind === "tree" && values[0] && <svg className="mt-chart" viewBox="0 0 240 75" role="img"
      aria-label={values[0] + " first branches, " + (values[1] || "unknown") + " leaves per branch"}>
      <path d="M18 35L92 13M18 35L92 56" stroke="currentColor" fill="none" />
      <text x="100" y="17">First of {values[0]}</text>
      <text x="100" y="60">Last of {values[0]}</text>
      {values[1] && <text x="125" y="38">{values[1]} leaves each</text>}
    </svg>}
    {field ? <>
      <fieldset className={control.kind === "ray" && index > 0 ? "mt-field-choices mt-ray-choice" : "mt-field-choices"} disabled={locked}>
        <legend className={onPart ? "mt-screen-reader" : undefined}>{partTitle}</legend>
        {calculator && mode === "number" && format
          ? <QuestionCalculator key={index} pi={calculator.pi} control={format} unit={unit} disabled={locked} onResult={submit} onDraft={onDraft} />
          : mode === "number" && format
          ? <NumericEntry key={index + ":" + retry} control={format} unit={unit} disabled={locked}
            onAnswer={submit} fractionDelayMs={fractionDelayMs} onDraft={onDraft} />
          : <div className="mt-field-buttons">{options.map(option => <button type="button" key={option} onClick={() => void submit(option)}>
            {control.kind === "ray" ? ({ Open: "○ Open", Closed: "● Closed", Left: "← Left", Right: "Right →" })[option] ?? option : option}
          </button>)}</div>}
      </fieldset>
      {feedback && <p role="status">{feedback}</p>}
    </> : control.kind === "boxplot" && <div className="mt-grid-actions">
      <button type="button" disabled={locked} onClick={() => {
        setValues([]);
        setPart(0);
        setRetry(0);
        setFeedback("");
      }}>Restart</button>
      <button type="button" disabled={locked} onClick={() => onAnswer(values.join("|"))}>Submit</button>
    </div>}
  </div>;
}
