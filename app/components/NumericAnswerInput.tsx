"use client";
import { useId } from "react";

export default function NumericAnswerInput({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const helpId = useId();
  return <div className="numeric-response">
    <label>Answer<input aria-describedby={helpId} autoComplete="off" spellCheck={false} type="text" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} maxLength={64} /></label>
    <p id={helpId}>Enter a number, decimal, fraction (3/4), or mixed number (−1 1/2).</p>
    <div className="numeric-response-keys" aria-label="Answer symbols">
      {["−", ".", "/", " "].map((symbol) => <button type="button" key={symbol} disabled={disabled} onClick={() => onChange(value + (symbol === "−" ? "-" : symbol))}>{symbol === " " ? "Space" : symbol}</button>)}
      <button type="button" disabled={disabled} onClick={() => onChange("")}>Clear</button>
    </div>
  </div>;
}
