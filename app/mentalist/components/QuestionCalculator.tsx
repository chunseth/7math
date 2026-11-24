import { useState } from "react";
import { calculatorDecimal, calculatorResponse, calculatorSettings, evaluateCalculation } from "../../../lib/mentalist/calculator";
import { equal, parseAnswer } from "../../../lib/curriculum/rational";
import { complete, type Control } from "../../../lib/mentalist/model";

const buttons = ["7", "8", "9", "÷", "(", ")", "4", "5", "6", "×", "^", "π", "1", "2", "3", "−", "%", "!", "0", ".", "⌫", "+", "Clear", "="];
const names: Record<string, string> = { "÷": "Divide", "×": "Multiply", "^": "Power", "π": "Pi", "−": "Minus", "%": "Percent", "!": "Factorial", "⌫": "Delete", "=": "Equals" };

export default function QuestionCalculator({ prompt, control, parts, disabled, onAnswer, onField }: {
  prompt: string;
  control: Control;
  parts: string[];
  disabled: boolean;
  onAnswer: (raw: string) => void;
  onField: (index: number, raw: string) => void;
}) {
  const settings = calculatorSettings(prompt, control);
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [target, setTarget] = useState(0);
  if (!settings) return null;
  const fields = control.fields;
  const { pi } = settings;

  function solve() {
    try {
      const value = evaluateCalculation(expression, pi);
      setResult(calculatorDecimal(value, 12).replace(/\.?0+$/, ""));
      setError("");
      if (fields) {
        const raw = fields[target].options.find(option => {
          const number = parseAnswer(option);
          return number && equal(value, number);
        });
        if (raw === undefined) return;
        onField(target, raw);
        const next = fields.findIndex((_, i) => i !== target && !parts[i]);
        if (next !== -1) setTarget(next);
      } else {
        const raw = calculatorResponse(value, control);
        if (raw && complete(control, raw)) onAnswer(raw);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Check the calculation and try again.");
      setResult("");
    }
  }

  function press(key: string) {
    if (key === "=") { solve(); return; }
    setError("");
    setResult("");
    if (key === "Clear") { setExpression(""); return; }
    if (key === "⌫") { setExpression(expression.slice(0, -1)); return; }
    const next = result ? (/^[+−×÷^!%]$/.test(key) ? result + key : key) : expression + key;
    if (next.length <= 128) setExpression(next);
  }

  return <details className="mt-calculator">
    <summary>Calculator</summary>
    {pi !== "3.14159265359" && <small>π = {pi}</small>}
    {fields && <label>Use result for <select value={target} disabled={disabled} onChange={event => setTarget(Number(event.target.value))}>
      {fields.map((field, i) => <option key={field.label} value={i}>{field.label}</option>)}
    </select></label>}
    <input aria-label="Calculator expression" autoComplete="off" maxLength={128} value={expression} disabled={disabled}
      onChange={event => { setExpression(event.target.value); setResult(""); setError(""); }} onKeyDown={event => {
        if (event.key === "Enter" || event.key === "=") { event.preventDefault(); if (!disabled) solve(); }
      }} />
    <output aria-live="polite">{error || result}</output>
    <div className="mt-calculator-keys">{buttons.map(key => <button key={key} type="button" aria-label={names[key] ?? key}
      disabled={disabled} onClick={() => press(key)}>{key}</button>)}</div>
  </details>;
}
