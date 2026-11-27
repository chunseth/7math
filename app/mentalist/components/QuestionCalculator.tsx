import { useState } from "react";
import { calculatorDecimal, calculatorResponse, evaluateCalculation } from "../../../lib/mentalist/calculator";
import { complete, type Control } from "../../../lib/mentalist/model";

const buttons = ["7", "8", "9", "÷", "(", ")", "4", "5", "6", "×", "^", "π", "1", "2", "3", "−", "%", "!", "0", ".", "⌫", "+", "Clear", "="];
const names: Record<string, string> = { "÷": "Divide", "×": "Multiply", "^": "Power", "π": "Pi", "−": "Minus", "%": "Percent", "!": "Factorial", "⌫": "Delete", "=": "Equals" };
const physicalKeys: Record<string, string> = { Enter: "=", Backspace: "⌫", Delete: "⌫", Escape: "Clear", "-": "−", "/": "÷", "*": "×" };

export default function QuestionCalculator({ pi, control, unit, disabled, onResult, onDraft }: {
  pi: string;
  control: Control;
  unit?: string;
  disabled: boolean;
  onResult: (raw: string) => void;
  onDraft?: (value: string) => void;
}) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  function solve() {
    try {
      const value = evaluateCalculation(expression, pi);
      setResult(calculatorDecimal(value, 12).replace(/\.?0+$/, ""));
      setError("");
      const raw = calculatorResponse(value, control);
      if (raw && complete(control, raw)) onResult(raw);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Check the calculation and try again.");
      setResult("");
    }
  }

  function updateExpression(value: string) {
    setExpression(value);
    onDraft?.(value);
  }

  function press(key: string) {
    if (disabled) return;
    if (key === "=") { solve(); return; }
    setError("");
    setResult("");
    if (key === "Clear") { updateExpression(""); return; }
    if (key === "⌫") { updateExpression(expression.slice(0, -1)); return; }
    const next = result ? (/^[+−×÷^!%]$/.test(key) ? result + key : key) : expression + key;
    if (next.length <= 128) updateExpression(next);
  }

  return <section className="mt-calculator" aria-label="Calculator" tabIndex={0} onKeyDown={event => {
    if (event.metaKey || event.ctrlKey || event.altKey || (event.key === "Enter" && event.target instanceof HTMLButtonElement)) return;
    const key = physicalKeys[event.key] ?? event.key;
    if (!buttons.includes(key)) return;
    event.preventDefault();
    press(key);
  }}>
    {pi !== "3.14159265359" && <small>π = {pi}</small>}
    <div className="mt-calculator-expression" aria-label="Calculator expression">{expression || "0"}</div>
    <output aria-live="polite">{error || (result ? result + (unit ? " " + unit : "") : "")}</output>
    <div className="mt-calculator-keys">{buttons.map(key => <button key={key} type="button" aria-label={names[key] ?? key}
      disabled={disabled} onClick={() => press(key)}>{key}</button>)}</div>
  </section>;
}
