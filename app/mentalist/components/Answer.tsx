"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Visual } from "./Visual";
import { complete, responseFieldMode, type Question } from "../../../lib/mentalist/model";
import Coordinate from "./Coordinate";
import ZoomableGraph from "./ZoomableGraph";
import QuestionCalculator from "./QuestionCalculator";
import StemEditor from "./StemEditor";
import Whiteboard from "./Whiteboard";
import { LoanCalculator } from "../../8math/Models";
export default function Answer({
  question,
  disabled,
  onAnswer,
}: {
  question: Question;
  disabled: boolean;
  onAnswer: (raw: string, calculated?: boolean) => void;
}) {
  const { control: c, prompt, visual } = question;
  const [value, setValue] = useState(""),
    [den, setDen] = useState(""),
    [field, setField] = useState(0);
  const [parts, setParts] = useState<string[]>([]),
    [revision, setRevision] = useState(0);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const sent = useRef(-1),
    send = useRef(onAnswer);
  send.current = onAnswer;
  const countEditor = c.kind === "dotplot" || c.kind === "histogram";
  const construction = countEditor || ["boxplot", "stem-plot", "scatterplot"].includes(c.kind);
  const manualSubmit = construction || c.kind === "ray" || c.fields?.some((field, i) => {
    const mode = responseFieldMode(c.kind, field, i);
    return mode === "number" || mode === "text";
  });
  const loan = visual?.kind === "loan";
  const fraction = c.kind === "fraction",
    numeric = !loan && ["whole", "fraction", "decimal"].includes(c.kind);
  const raw = c.fields
    ? c.fields.map((_, i) => parts[i] ?? (countEditor ? "0" : "")).join("|")
    : fraction
      ? value + "/" + den
      : value;
  const ready = visible && !disabled && complete(c, raw);
  const check = useCallback(() => {
    if (!ready || sent.current === revision) return;
    sent.current = revision;
    send.current(raw);
  }, [ready, raw, revision]);
  useEffect(() => {
    if (!ready || sent.current === revision || manualSubmit) return;
    if (!fraction) {
      check();
      return;
    }
    const timer = setTimeout(check, 800);
    return () => clearTimeout(timer);
  }, [check, ready, revision, fraction, manualSubmit]);
  function setPart(index: number, value: string) {
    setParts(previous => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
    setRevision(previous => previous + 1);
  }
  function edit(key: string) {
    if (disabled) return;
    if (key === "/" && fraction) {
      setField(current => 1 - current);
      return;
    }
    const old = field === 1 ? den : value;
    const next =
      key === "Clear"
        ? ""
        : key === "Backspace"
          ? old.slice(0, -1)
          : key === "Sign"
            ? old.startsWith("-")
              ? old.slice(1)
              : "-" + old
            : key === "."
              ? old === "-"
                ? "-0."
                : old
                  ? old + "."
                  : "0."
              : old + key;
    if (next === old || next.length > 13 || !/^[-]?\d*\.?\d*$/.test(next)) return;
    if (key === "." && (fraction || !c.places)) return;
    if (!fraction && next.split(".")[0].replace("-", "").length > c.width!) return;
    if (
      !fraction &&
      next.includes(".") &&
      (next.split(".")[1].length > Number(c.places) || next.split(".")[0].replace("-", "").length !== c.width)
    )
      return;
    setRevision((i) => i + 1);
    (field === 1 ? setDen : setValue)(next);
  }
  const keys = useRef(edit);
  keys.current = edit;
  useEffect(() => {
    if (!numeric) return;
    const press = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey ||
          (e.target instanceof Element && e.target.closest("input, select, textarea, [contenteditable=true], .mt-calculator"))) return;
      let key = e.key;
      if (key === "Enter" && fraction && ready && !e.repeat &&
          (e.target === document.body || (e.target instanceof Element && e.target.closest(".mt-entry")))) {
        e.preventDefault();
        check();
        return;
      }
      if (key === "-") {
        if (!c.signed) return;
        key = "Sign";
      }
      if (key === "Delete") key = "Clear";
      if (!/^\d$/.test(key) && !["Backspace", "Clear", "Sign", "/", "."].includes(key)) return;
      e.preventDefault();
      keys.current(key);
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, [numeric, c.signed, fraction, ready, check]);
  const calculator = <QuestionCalculator prompt={prompt} control={c} parts={parts} disabled={disabled || !visible}
    onAnswer={raw => send.current(raw, true)} onField={(index, value) => {
      const next = [...parts];
      next[index] = value;
      const submitted = c.fields!.map((_, i) => next[i] ?? "").join("|");
      setParts(next);
      sent.current = revision + 1;
      setRevision(revision + 1);
      if (complete(c, submitted)) send.current(submitted, true);
    }} />;
  if (loan) return <LoanCalculator values={visual.values!} disabled={disabled} onAnswer={value => {
    if (disabled || !complete(c, value)) return false;
    send.current(value);
    return true;
  }} />;
  if (c.options)
    return (
      <div className="mt-options">
        {c.options.map((o) => (
          <button
            disabled={disabled}
            onClick={() => {
              setValue(o);
              setRevision((i) => i + 1);
            }}
            key={o}
          >
            {o}
          </button>
        ))}
      </div>
    );
  if (c.fields)
    return (
      <div className="mt-fields">
        {calculator}
        {countEditor && <>
          <p>Tap a {c.kind === "dotplot" ? "tick" : "bin"} to change its count.</p>
          <Visual data={{ kind: c.kind, labels: c.fields.map(f => f.label), values: c.fields.map((_, i) => Number(parts[i] || 0)) }}
            editChart={disabled ? undefined : { active: activeCount, select: setActiveCount }} />
          {activeCount !== null && <div className="mt-field-buttons" role="group" aria-label={`Count for ${c.fields[activeCount].label}`}>
            <button type="button" disabled={disabled || !Number(parts[activeCount])} aria-label="Decrease count"
              onClick={() => setPart(activeCount, String(Number(parts[activeCount]) - 1))}>−</button>
            <output>{Number(parts[activeCount] || 0)}</output>
            <button type="button" disabled={disabled || Number(parts[activeCount] || 0) >= 2 * Math.max(...c.fields!.flatMap(field => field.options.map(Number)))}
              aria-label="Increase count" onClick={() => setPart(activeCount, String(Number(parts[activeCount] || 0) + 1))}>+</button>
          </div>}
        </>}
        {c.kind === "stem-plot" && <StemEditor prompt={prompt} labels={c.fields.map(field => field.label)} disabled={disabled}
          onChange={rows => { setParts(rows); setRevision(previous => previous + 1); }} />}
        {c.kind === "boxplot" && parts.filter(Boolean).length === 5 &&
          parts.every((value, i) => i === 0 || Number(value) >= Number(parts[i - 1])) &&
          <Visual data={{kind: "boxes", rows: [parts], labels: ["Your plot"]}} />}
        {c.kind === "ray" && parts[0] && <ZoomableGraph>
          <svg
            className="mt-chart"
            viewBox="0 0 240 55"
            role="img"
            aria-label={parts.filter(Boolean).join(", ")}
          >
            <path d="M12 25H228" stroke="#a2b8ae" />
            {parts[2] && (
              <path
                d={parts[2] === "Right" ? "M120 25H220m-8 -5 8 5-8 5" : "M120 25H20m8 -5 -8 5 8 5"}
                fill="none"
                stroke="#347758"
                strokeWidth="3"
              />
            )}
            <circle
              cx="120"
              cy="25"
              r="5"
              stroke="#347758"
              strokeWidth="2"
              fill={parts[1] === "Closed" ? "#347758" : "white"}
            />
            <text x="120" y="47" textAnchor="middle">
              {parts[0]}
            </text>
          </svg>
        </ZoomableGraph>}
        {c.kind === "tree" && parts[0] && (
          <svg
            className="mt-chart"
            viewBox="0 0 240 75"
            role="img"
            aria-label={parts[0] + " first branches, " + (parts[1] || "unknown") + " leaves per branch"}
          >
            <path d="M18 35L92 13M18 35L92 56" stroke="currentColor" fill="none" />
            <text x="100" y="17">
              First of {parts[0]}
            </text>
            <text x="100" y="60">
              Last of {parts[0]}
            </text>
            {parts[1] && (
              <text x="125" y="38">
                {parts[1]} leaves each
              </text>
            )}
          </svg>
        )}
        {!countEditor && c.kind !== "stem-plot" && c.fields.map((f, i) => {
          const mode = responseFieldMode(c.kind, f, i);
          const label = c.kind === "net" && i < 2 ? `Number of ${f.label.toLowerCase()}` : f.label;
          if (mode === "buttons") return <fieldset className="mt-field-choices" disabled={disabled} key={f.label}>
            <legend>{label}</legend>
            <div className="mt-field-buttons">{f.options.map(option => <button key={option} type="button"
              aria-pressed={parts[i] === option} onClick={() => setPart(i, option)}>
              {c.kind === "ray" ? ({ Open: "○ Open", Closed: "● Closed", Left: "← Left", Right: "Right →" })[option] ?? option : option}
            </button>)}</div>
          </fieldset>;
          return <label key={f.label}>{label}{mode === "number" || mode === "text" ?
            <input value={parts[i] ?? ""} type="text" inputMode={mode === "text" || f.options.some(option => /^-|\//.test(option)) ? "text" : "decimal"}
              autoComplete="off" maxLength={26} disabled={disabled} onChange={event => setPart(i, event.target.value)} /> :
            <select disabled={disabled} value={parts[i] ?? ""} onChange={event => setPart(i, event.target.value)}>
              <option value="">Choose…</option>{f.options.map(option => <option key={option}>{option}</option>)}
            </select>}
          </label>;
        })}
        {manualSubmit && <button type="button" disabled={!ready || sent.current === revision} onClick={check}>
          {c.kind === "ray" ? "Check number line" : construction ? "Check display" : "Check answer"}
        </button>}
      </div>
    );
  if (c.limit)
    return (
      <>
      <Coordinate
        step={c.step ?? 1}
        origin={c.origin ?? 0}
        scatter={c.kind === "scatterplot"}
        count={c.points ?? 1}
        limit={c.limit}
        line={c.kind === "line"}
        drawing={c.kind === "drawing"}
        drawingScale={c.kind === "drawing" ? Number(/\bat (\d+) m per square/.exec(prompt)?.[1] ?? 1) : 1}
        disabled={disabled}
        onPick={(points) => {
          setValue(points);
          setRevision((i) => i + 1);
        }}
      />
      {construction && <button type="button" disabled={!ready} onClick={check}>Check plot</button>}
      </>
    );
  const unit = responseUnit(question);
  return (
    <div className="mt-entry">
      {calculator}
      {(/compounded annually for two years|difference between the two savings in dollars|A rectangular prism has volume.*A pyramid shares its base and height/.test(prompt)) && <Whiteboard />}
      <div className="mt-answer" aria-label="Answer">
        {fraction ? (
          <>
            <button
              className={field === 0 ? "selected" : ""}
              onClick={() => setField(0)}
              aria-label="Numerator"
            >
              {value || "□"}
            </button>
            <span>/</span>
            <button
              className={field === 1 ? "selected" : ""}
              onClick={() => setField(1)}
              aria-label="Denominator"
            >
              {den || "□"}
            </button>
          </>
        ) : (
          <output>{value || "□".repeat(c.width ?? 1) + (c.places ? "." + "□".repeat(c.places) : "")}
            {unit && <span className="mt-answer-unit">{unit}</span>}
          </output>
        )}
      </div>
      <div className="mt-keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", fraction ? "/" : "Clear", "0", "Backspace"].map((k) => (
          <button type="button" key={k} disabled={disabled} onClick={() => edit(k)}
            aria-label={k === "/" ? `Switch to ${field === 0 ? "denominator" : "numerator"}` : k}
            className={k === "/" ? "mt-fraction-switch" : undefined}>
            {k === "Backspace" ? "⌫" : k === "/" ? (field === 0 ? "Denominator" : "Numerator") : k}
          </button>
        ))}
      </div>
      <div className="mt-extra">
        {c.signed && (
          <button disabled={disabled} onClick={() => edit("Sign")}>
            ± Sign
          </button>
        )}
        {!!c.places && (
          <button disabled={disabled} onClick={() => edit(".")}>
            . Decimal
          </button>
        )}
        {fraction && <button disabled={!ready || sent.current === revision} onClick={check}>Check answer</button>}
      </div>
    </div>
  );
}
function responseUnit({ prompt, visual }: Question) {
  if (/^What percent of the (hundred grid|strip) is shaded\?$/.test(prompt)) return "%";
  if (visual?.kind === "scaled-axis" && prompt.endsWith("Give the answer in liters.")) return "L";
  if (prompt.endsWith("difference between the two savings in dollars?")) return "dollars";
  return "";
}
