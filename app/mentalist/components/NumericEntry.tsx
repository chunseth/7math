import { useEffect, useRef, useState } from "react";
import NumberPad from "../../components/NumberPad";
import { complete, type Control } from "../../../lib/mentalist/model";

export function editNumber(old: string, key: string) {
  if (key === "Backspace") return old.slice(0, -1);
  if (key === "Sign") return old.startsWith("-") ? old.slice(1) : "-" + old;
  if (key === "." && (old === "" || old === "-")) return old + "0.";
  return old + key;
}

export default function NumericEntry({ control, unit, disabled, onAnswer, fractionDelayMs = 800 }: {
  control: Control;
  unit?: string;
  disabled: boolean;
  onAnswer: (raw: string) => void;
  fractionDelayMs?: number;
}) {
  const [value, setValue] = useState("");
  const [den, setDen] = useState("");
  const [denominator, setDenominator] = useState(false);
  const submitted = useRef("");
  const send = useRef(onAnswer);
  send.current = onAnswer;
  const fraction = control.kind === "fraction";
  const raw = fraction ? value + "/" + den : value;
  const ready = !disabled && complete(control, raw);

  useEffect(() => {
    if (!ready || raw === submitted.current) return;
    function check() {
      if (document.hidden) return;
      submitted.current = raw;
      send.current(raw);
    }
    if (!fraction) { check(); return; }
    const timer = setTimeout(check, fractionDelayMs);
    return () => clearTimeout(timer);
  }, [ready, raw, fraction, fractionDelayMs]);

  function edit(key: string) {
    if (disabled) return;
    if (key === "/" && fraction) { setDenominator(current => !current); return; }
    const old = denominator ? den : value;
    const next = editNumber(old, key);
    if (next === old || next.length > 13 || !/^-?\d*\.?\d*$/.test(next)) return;
    if (!fraction) {
      const [whole, decimal] = next.replace("-", "").split(".");
      if (whole.length > control.width!) return;
      if (decimal !== undefined && (!control.places || whole.length !== control.width || decimal.length > control.places)) return;
    } else if (next.includes(".")) return;
    submitted.current = "";
    (denominator ? setDen : setValue)(next);
  }

  const keys = useRef(edit);
  keys.current = edit;
  useEffect(() => {
    function press(event: KeyboardEvent) {
      if (disabled || event.ctrlKey || event.metaKey || event.altKey ||
          (event.target instanceof Element && event.target.closest("input, select, textarea, [contenteditable=true], .mt-calculator"))) return;
      if (event.key === "Enter" && fraction && ready && !event.repeat && event.target === document.body) {
        if (submitted.current !== raw) { submitted.current = raw; send.current(raw); }
        return;
      }
      const key = event.key === "-" && control.signed ? "Sign" : event.key === "Delete" ? "Backspace" : event.key;
      if (!/^\d$/.test(key) && !["Backspace", "Sign", "/", "."].includes(key)) return;
      if ((key === "/" && !fraction) || (key === "." && !control.places)) return;
      event.preventDefault();
      keys.current(key);
    }
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, [disabled, control.signed, control.places, fraction, ready, raw]);

  const controls = [];
  if (control.places) controls.push({ key: ".", label: ".", name: "Decimal point" });
  if (fraction) {
    const target = denominator ? "Numerator" : "Denominator";
    controls.push({ key: "/", label: target, name: "Switch to " + target.toLowerCase() });
  }
  if (control.signed) controls.push({ key: "Sign", label: "±", name: "Change sign" });

  return <div className="mt-entry">
    <div className="mt-answer" aria-label="Answer">
      {fraction ? <>
        <button type="button" disabled={disabled} className={!denominator ? "selected" : ""} aria-label="Numerator"
          aria-pressed={!denominator} onClick={() => setDenominator(false)}>{value || "□"}</button>
        <span> / </span>
        <button type="button" disabled={disabled} className={denominator ? "selected" : ""} aria-label="Denominator"
          aria-pressed={denominator} onClick={() => setDenominator(true)}>{den || "□"}</button>
        {unit && <span className="mt-answer-unit">{unit}</span>}
      </> : <output>
        {value || "□".repeat(control.width ?? 1) + (control.places ? "." + "□".repeat(control.places) : "")}
        {unit && <span className="mt-answer-unit">{unit}</span>}
      </output>}
    </div>
    <NumberPad className="mt-keypad" controls={controls} disabled={disabled} onKey={edit} />
  </div>;
}
