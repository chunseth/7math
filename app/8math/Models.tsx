"use client";
import { useState } from "react";

export function LoanCalculator({ values, disabled, onAnswer }: {
  values: number[];
  disabled?: boolean;
  onAnswer?: (value: string) => boolean;
}) {
  const [principal, setPrincipal] = useState(onAnswer ? "" : String(values[0]));
  const [apr, setApr] = useState(onAnswer ? "" : String(values[1]));
  const [months, setMonths] = useState(onAnswer ? "" : String(values[2]));
  const [payment, setPayment] = useState("");
  const [message, setMessage] = useState("");
  const [operation, setOperation] = useState("");
  const [operand, setOperand] = useState("");
  function clearCalculation() {
    setOperation("");
    setOperand("");
  }
  return <div className="mt-fields"><fieldset disabled={disabled} className="mt-loan-calculator"><legend>Monthly payment calculator</legend>
    {([["Principal ($)",principal,setPrincipal],["Annual rate (%)",apr,setApr],["Months",months,setMonths]] as const)
      .map(([label,value,set]) => <label key={label}>{label}<input type="number" min="0" inputMode="decimal" value={value}
        onChange={e => { set(e.target.value); setPayment(""); setMessage(""); clearCalculation(); }} /></label>)}
    <button type="button" onClick={() => {
      const rate=Number(apr)/1200, count=Number(months), amount=Number(principal);
      if (!principal || !apr || !Number.isFinite(amount) || !Number.isFinite(rate) || amount <= 0 || rate < 0 || !Number.isInteger(count) || count < 1) {
        setMessage("Enter a positive principal, a nonnegative rate, and a positive whole number of months.");
        return;
      }
      if (onAnswer && (amount !== values[0] || Number(apr) !== values[1] || count !== values[2])) {
        setMessage("Check the principal, annual rate, and months against the question.");
        return;
      }
      const monthly = rate === 0 ? amount/count : amount*rate/(1-(1+rate)**(-count));
      setMessage("");
      setPayment(monthly.toFixed(2));
    }}>Calculate</button><output aria-live="polite">{payment && `Monthly payment $${payment}`}</output>
  </fieldset>
  {onAnswer && payment && <fieldset disabled={disabled} className="mt-loan-calculator"><legend>Total payment calculator</legend>
    <label>First number ($)<input value={payment} readOnly /></label>
    <label>Operation<select value={operation} onChange={event => setOperation(event.target.value)}>
      <option value="">Choose…</option><option>+</option><option>−</option><option>×</option><option>÷</option>
    </select></label>
    <label>Second number<input value={operand} inputMode="decimal" type="number" onChange={event => setOperand(event.target.value)} /></label>
    <button type="button" aria-label="Equals" disabled={disabled || !operation || !operand.trim()} onClick={() => {
      const monthly = Number(payment), other = Number(operand);
      const total = operation === "×" ? monthly * other : operation === "+" ? monthly + other
        : operation === "−" ? monthly - other : monthly / other;
      const sent = Number.isFinite(total) && onAnswer(total.toFixed(2));
      setMessage(sent ? "" : "Check the operation and second number, then try again.");
      clearCalculation();
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
    <path d="M30 10V115H219" fill="none" stroke="currentColor" />
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
