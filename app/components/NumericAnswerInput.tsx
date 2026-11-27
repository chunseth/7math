"use client";

import NumberPad from "./NumberPad";

const controls = [
  { key: ".", label: ".", name: "Decimal point" },
  { key: "/", label: "/", name: "Fraction slash" },
  { key: "-", label: "±", name: "Change sign" },
];

export default function NumericAnswerInput({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  function edit(key: string) {
    if (disabled) return;
    if (key === "Backspace" || key === "Delete") onChange(value.slice(0, -1));
    else if (key === "-") onChange(value.startsWith("-") ? value.slice(1) : "-" + value);
    else if (value.length < 64) onChange(value + key);
  }

  return <div className="numeric-response" tabIndex={0} onKeyDown={event => {
    if (event.metaKey || event.ctrlKey || event.altKey || (event.key === " " && event.target instanceof HTMLButtonElement)) return;
    if (!/^[0-9 .\/-]$/.test(event.key) && !["Backspace", "Delete"].includes(event.key)) return;
    event.preventDefault();
    edit(event.key);
  }}>
    <output aria-label="Answer">{value || "—"}</output>
    <p>Enter a number, decimal, fraction (3/4), or mixed number (−1 1/2).</p>
    <NumberPad className="numeric-response-pad" controls={controls} disabled={disabled} onKey={edit} />
    <button type="button" disabled={disabled} onClick={() => edit(" ")}>Space</button>
  </div>;
}
