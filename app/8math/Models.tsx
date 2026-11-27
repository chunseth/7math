"use client";
import { useEffect, useState } from "react";
import NumberPad from "../components/NumberPad";
import { editNumber } from "../mentalist/components/NumericEntry";

const loanLabels = ["Principal ($)", "Annual rate (%)", "Number of months"];

export function LoanCalculator({ values, disabled = false, onAnswer, onPart }: {
  values: number[];
  disabled?: boolean;
  onAnswer?: (value: string) => void;
  onPart?: (title: string) => void;
}) {
  const [index, setIndex] = useState(onAnswer ? 0 : 3);
  const [entry, setEntry] = useState("");
  const [payment, setPayment] = useState("");
  const [message, setMessage] = useState("");
  const [operation, setOperation] = useState("");
  const [operand, setOperand] = useState("");
  useEffect(() => {
    onPart?.(payment ? "Find total payments in dollars." : `Part ${index + 1} of 3 · ${loanLabels[index]}`);
  }, [index, onPart, payment]);
  const decimal = [{ key: ".", label: ".", name: "Decimal point" }];
  function edit(old: string, key: string) {
    const next = editNumber(old, key);
    return next.length <= 13 && /^\d*(?:\.\d*)?$/.test(next) ? next : old;
  }
  function monthly() {
    const [principal, apr, months] = values;
    const rate = apr / 1200;
    return (rate === 0 ? principal / months : principal * rate / (1 - (1 + rate) ** (-months))).toFixed(2);
  }
  return <div className="mt-fields">
    {!payment && <fieldset disabled={disabled} className="mt-loan-calculator"><legend>Monthly payment calculator</legend>
      {index < 3 ? <>
        {!onPart && <p>Part {index + 1} of 3 · {loanLabels[index]}</p>}
        <output aria-label={loanLabels[index]}>{entry || "—"}</output>
        <NumberPad className="mt-keypad" controls={index < 2 ? decimal : []} disabled={disabled}
          onKey={key => { setEntry(edit(entry, key)); setMessage(""); }} />
        <button type="button" disabled={!entry} onClick={() => {
          if (Number(entry) !== values[index]) { setMessage("Check that value against the question."); return; }
          if (index === 2) setPayment(monthly());
          setIndex(index + 1);
          setEntry("");
          setMessage("");
        }}>{index === 2 ? "Calculate monthly payment" : "Next"}</button>
      </> : <>
        <p>${values[0]} at {values[1]}% APR for {values[2]} months.</p>
        <button type="button" onClick={() => setPayment(monthly())}>Calculate monthly payment</button>
      </>}
    </fieldset>}
    {payment && <output aria-live="polite">Monthly payment ${payment}</output>}
    {onAnswer && payment && <fieldset disabled={disabled} className="mt-loan-calculator"><legend>Total payment calculator</legend>
      <output aria-label="Total payment calculation">${payment} {operation} {operand}</output>
      <div className="mt-field-buttons" aria-label="Operation" role="group">
        {["+", "−", "×", "÷"].map(symbol => <button type="button" key={symbol} aria-pressed={operation === symbol}
          onClick={() => { setOperation(symbol); setMessage(""); }}>{symbol}</button>)}
      </div>
      <NumberPad className="mt-keypad" controls={decimal} disabled={disabled} onKey={key => { setOperand(edit(operand, key)); setMessage(""); }} />
      <button type="button" aria-label="Equals" disabled={!operation || !operand} onClick={() => {
        const a = Number(payment), b = Number(operand);
        const total = operation === "×" ? a * b : operation === "+" ? a + b : operation === "−" ? a - b : a / b;
        const result = total.toFixed(2);
        if (Number.isFinite(total) && result === (a * values[2]).toFixed(2)) { onAnswer(result); return; }
        setMessage("Check the operation and second number, then try again.");
        setOperation("");
        setOperand("");
      }}>=</button>
    </fieldset>}
    {message && <p role="status">{message}</p>}
  </div>;
}

export function BivariatePlot({ points, intersection }: { points: number[][]; intersection: boolean }) {
  const maxX = Math.max(1,...points.map(p => p[0])), maxY = Math.max(1,...points.map(p => p[1]));
  const x = (n:number) => 30 + n/maxX*175, y = (n:number) => 115 - n/maxY*99;
  return <svg className="mt-chart" viewBox="0 0 240 142" role="img"
    aria-label={(intersection ? "Two lines through these endpoint pairs. " : "Scatterplot. ") + points.map(p=>"("+p.join(", ")+")").join(", ")}>
    <path d="M30 16V115H219" fill="none" stroke="currentColor" />
    <text x="14" y="128">0</text><text x="196" y="131">{maxX}</text><text x="2" y="20">{maxY}</text>
    <text x="224" y="117">x</text><text x="31" y="11">y</text>
    {intersection && [1,2,3].map(i => {
      const gx = maxX * i / 4, gy = maxY * i / 4;
      return <g key={i}>
        <path d={`M${x(gx)} 115V16M30 ${y(gy)}H205`} stroke="#c9dad5" />
        <text x={x(gx)} y="127" textAnchor="middle" fontSize="8">{gx}</text>
        <text x="26" y={y(gy) + 3} textAnchor="end" fontSize="8">{gy}</text>
      </g>;
    })}
    {intersection && [0,2].map(i=><line key={i} x1={x(points[i][0])} y1={y(points[i][1])}
      x2={x(points[i+1][0])} y2={y(points[i+1][1])} stroke={i ? "#a94f32" : "#227366"} strokeWidth="2.5" />)}
    {points.map(([a,b],i)=><circle key={i} cx={x(a)} cy={y(b)} r="3.2" fill="#1d6059" />)}
  </svg>;
}

export function SquareAreas({ labels }: { labels: string[] }) {
  return <svg viewBox="0 0 230 150" className="mt-chart" role="img" aria-label={"Squares on the legs and hypotenuse: " + labels.join(", ")}>
    <path d="M76 73h40v30z" fill="#fff" stroke="#285a4c" /><path d="M76 73V33h40v40z" fill="#b9d9c4" stroke="#285a4c" />
    <path d="M116 73h30v30h-30z" fill="#d3dcee" stroke="#285a4c" /><path d="M76 73l40 30-30 40-40-30z" fill="#efcf9c" stroke="#285a4c" />
    {labels.map((label,i)=><text key={i} textAnchor="middle" fontSize="12" x={[131,96,79][i]} y={[92,56,112][i]}>{label}</text>)}
  </svg>;
}

export function SampleExperiment() {
  const [samples,setSamples] = useState<number[]>([]);
  return <details className="mt-data"><summary>Run a sampling experiment</summary>
    <p>A bag contains equal numbers of blue and gold counters. Draw 20 times with replacement. Compare each sample with the population’s 50% blue.</p>
    <button onClick={() => {
      let blue = 0;
      for (let i=0;i<20;i++) if (Math.random()<.5) blue++;
      setSamples(current=>[...current,blue*5]);
    }}>Draw a sample of 20</button>
    <output aria-live="polite">{samples.map(p => p+"%").join(" · ")}</output>
  </details>;
}
