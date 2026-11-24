import type { Visual as Data } from "../../../lib/mentalist/model";
import { BivariatePlot, LoanCalculator, SquareAreas } from "../../8math/Models";
import { useState } from "react";
import ZoomableGraph from "./ZoomableGraph";
export function Visual({ data, onSimulated }: { data?: Data; onSimulated?: () => void }) {
  const [draws, setDraws] = useState(0);
  if (!data) return null;
  const vals = data.values ?? [],
    labels = data.labels ?? [];
  if (data.kind === "loan") return <LoanCalculator values={vals} />;
  if (data.kind === "scatter" || data.kind === "intersection") return <ZoomableGraph>
    <BivariatePlot points={data.points!} intersection={data.kind === "intersection"} />
  </ZoomableGraph>;
  if (data.kind === "pythagorean") return <SquareAreas labels={labels} />;
  if (data.kind === "simulation")
    return (
      <div className="mt-data">
        <button
          onClick={() => {
            const next = Math.min(draws + 1, data.outcomes!.length);
            setDraws(next);
            if (next === data.outcomes!.length) onSimulated?.();
          }}
          disabled={draws >= data.outcomes!.length}
        >
          {data.sampleSize ? `Draw sample of ${data.sampleSize}` : "Run next trial"}
        </button>
        <output>{data.outcomes!.slice(0, draws).join(" · ")}</output>
      </div>
    );
  if (data.kind === "data")
    return (
      <div className="mt-data">
        <table>
          <thead>
            <tr>
              {data.headers?.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows?.map((r, i) => (
              <tr key={i}>
                {r.map((x, j) => (
                  <td key={j}>{x}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.source && (
          <a href={data.source} target="_blank" rel="noreferrer">
            Estimator source
          </a>
        )}
      </div>
    );
  if (data.kind === "scaled-axis") {
    const [xStep, yStep] = vals;
    const [[x, y]] = data.points!;
    const ticks = [1, 2, 3, 4];
    const left = 35, bottom = 110, horizontal = 44, vertical = 22;
    return <ZoomableGraph><svg className="mt-chart" viewBox="0 0 235 146" role="img"
      aria-label={`Minutes per horizontal tick: ${xStep}. Liters per vertical tick: ${yStep}. Marked point: ${x / xStep} ticks right and ${y / yStep} ticks up.`}>
      <text x={left} y="14">{labels[1]}</text>
      <path d={`M${left} 19V${bottom}H221`} fill="none" stroke="currentColor" />
      <text x={left - 5} y={bottom + 12} textAnchor="end" fontSize="11">0</text>
      {ticks.map(i => <g key={i} fontSize="11">
        <path d={`M${left - 3} ${bottom - i * vertical}H${left + 4 * horizontal}M${left + i * horizontal} 22V${bottom + 3}`}
          stroke="#a2b8ae" fill="none" />
        <text x={left - 8} y={bottom - i * vertical + 4} textAnchor="end">{i * yStep}</text>
        <text x={left + i * horizontal} y={bottom + 15} textAnchor="middle">{i * xStep}</text>
      </g>)}
      <circle cx={left + (x / xStep) * horizontal} cy={bottom - (y / yStep) * vertical} r="4" fill="#317e6c" />
      <text x="221" y="142" textAnchor="end">{labels[0]}</text>
    </svg></ZoomableGraph>;
  }
  if (data.kind === "plot") {
    const pts = data.points!,
      maxX = Math.max(...pts.map((p) => p[0])),
      maxY = Math.max(...pts.map((p) => p[1]));
    return (
      <ZoomableGraph>
      <svg
        className="mt-chart"
        viewBox="0 0 240 115"
        role="img"
        aria-label={pts.map((p) => p.join(", ")).join(" to ")}
      >
        <path d="M26 10V90H225" fill="none" stroke="currentColor" />
        <polyline
          points={pts.map(([x, y]) => [26 + (165 * x) / maxX, 90 - (64 * y) / maxY].join(",")).join(" ")}
          fill="none"
          stroke="#14766b"
          strokeWidth="3"
        />
        {pts.map(([x, y]) => (
          <text key={x} x={30 + (165 * x) / maxX} y={86 - (64 * y) / maxY}>
            {x}, {y}
          </text>
        ))}
        <text x="100" y="111">
          {labels[0]}
        </text>
        <text x="30" y="12">{labels[1]}</text>
      </svg>
      </ZoomableGraph>
    );
  }
  if (data.kind === "benchmark-percent") {
    const [parts, mark] = vals;
    const position = (i: number) => 14 + (212 * i) / parts;
    const line = labels[0] === "line";
    const graph = <svg className="mt-chart" viewBox="0 0 240 58" role="img"
      aria-label={line ? `Number line from zero to one hundred percent. Tick ${mark} of ${parts} equal intervals is marked.` :
        `Strip with ${mark} of ${parts} equal parts shaded.`}>
      {line ? <>
        <path d="M14 25H226" stroke="currentColor" />
        {Array.from({length: parts + 1}, (_, i) =>
          <path key={i} d={`M${position(i)} 19V31`} stroke="currentColor" />)}
        <circle cx={position(mark)} cy="25" r="5" fill="#317e6c" />
        <text x="14" y="50">0%</text>
        <text x="226" y="50" textAnchor="end">100%</text>
      </> : Array.from({length: parts}, (_, i) =>
        <rect key={i} x={position(i)} y="13" width={212 / parts} height="28"
          fill={i < mark ? "#317e6c" : "white"} stroke="currentColor" />)}
    </svg>;
    return line ? <ZoomableGraph>{graph}</ZoomableGraph> : graph;
  }
  if (data.kind === "triangle")
    return (
      <svg className="mt-chart" viewBox="0 0 200 100" role="img" aria-label={labels.join(", ")}>
        <path d="M20 88L92 10L180 88Z" fill="#def4e9" stroke="#397f70" />
        {labels.map((l, i) => (
          <text key={i} x={[43, 82, 135][i]} y={[80, 43, 80][i]}>
            {l}
          </text>
        ))}
      </svg>
    );
  if (data.kind === "boxes") {
    const rr = data.rows!.map((r) => r.map(Number)),
      min = Math.min(...rr.flat()),
      max = Math.max(...rr.flat());
    const px = (v: number) => 55 + (155 * (v - min)) / Math.max(1, max - min);
    return (
      <ZoomableGraph>
        <svg
          viewBox="0 0 240 108"
          className="mt-chart"
          role="img"
          aria-label={rr.map((r, i) => labels[i] + ": " + r.join(", ")).join(". ")}
        >
          {rr.map(([lo, q1, m, q3, hi], i) => {
            const y = 20 + i * 50;
            return (
              <g key={i}>
                <text x="0" y={y + 4}>
                  {labels[i]}
                </text>
                <path d={`M${px(lo)} ${y}H${px(hi)}`} stroke="currentColor" />
                <rect
                  x={px(q1)}
                  y={y - 7}
                  width={px(q3) - px(q1)}
                  height={14}
                  fill="#afdcc8"
                  stroke="currentColor"
                />
                <path d={`M${px(m)} ${y - 7}v14`} stroke="currentColor" />
                <text x="55" y={y + 24}>
                  {[lo, q1, m, q3, hi].join(" · ")}
                </text>
              </g>
            );
          })}
        </svg>
      </ZoomableGraph>
    );
  }
  if (data.kind === "sets")
    return (
      <div className="mt-sets">
        {labels.reduceRight<React.ReactNode>(
          (inside, label) => (
            <div key={label}>
              {label}
              {inside}
            </div>
          ),
          null,
        )}
      </div>
    );
  if (data.kind === "chips" || data.kind === "counters")
    return (
      <div
        className="mt-counters"
        aria-label={
          data.kind === "chips"
            ? vals[0] + " positive chips, " + vals[1] + " negative chips"
            : vals[0] + " counters"
        }
      >
        {Array.from({ length: vals[0] }, (_, i) => (
          <i key={"a" + i}>{data.kind === "chips" ? "+" : "●"}</i>
        ))}
        {Array.from({ length: vals[1] ?? 0 }, (_, i) => (
          <i className="negative" key={"b" + i}>
            −
          </i>
        ))}
      </div>
    );
  if (data.kind === "signed-groups") {
    const [groups, size] = vals;
    return <div className="mt-data" aria-label={`${groups} groups of ${size} negative chips`}>
      {Array.from({length: groups}, (_, group) =>
        <span key={group} style={{display: "inline-block", padding: "2px 5px", margin: 3, border: "1px solid currentColor", borderRadius: 4}}>
          {Array.from({length: size}, () => "−").join(" ")}
        </span>)}
    </div>;
  }
  if (data.kind === "balance")
    return (
      <div
        className="mt-data mt-balance"
        aria-label={vals[0] + " boxes plus " + vals[1] + " units equals " + vals[2]}
      >
        <b>{"▣ ".repeat(vals[0])}</b> + {vals[1]} = {vals[2]}
      </div>
    );
  if (data.kind === "hundred")
    return <svg className="mt-chart" viewBox="0 0 104 104" role="img" aria-label={`Ten-by-ten grid with ${vals[0]} shaded squares`}>
      {Array.from({ length: 100 }, (_, i) => <rect key={i} x={2 + 10 * (i % 10)} y={2 + 10 * Math.floor(i / 10)}
        width="10" height="10" fill={i < vals[0] ? "#317e6c" : "#fff"} stroke="#72847b" strokeWidth=".65" />)}
    </svg>;
  if (data.kind === "dotplot") {
    const x = (i: number) => 35 + 160 * i / Math.max(1, vals.length - 1);
    return <ZoomableGraph><svg className="mt-chart" viewBox="0 0 230 105" role="img"
      aria-label={vals.map((count, i) => `${labels[i]}: ${count} dots`).join(", ")}>
      <path d="M20 81H210" stroke="currentColor" />
      {vals.map((count, i) => <g key={i}>
        <path d={`M${x(i)} 77V85`} stroke="currentColor" />
        <text x={x(i)} y="100" textAnchor="middle">{labels[i]}</text>
        {Array.from({length: count}, (_, j) => <circle key={j} cx={x(i)} cy={72 - 12 * j} r="4" fill="#317e6c" />)}
      </g>)}
    </svg></ZoomableGraph>;
  }
  if (data.kind === "histogram") {
    const width = 220 / vals.length;
    const scale = 65 / Math.max(1, ...vals);
    return <ZoomableGraph><svg className="mt-chart" viewBox="0 0 250 115" role="img" aria-label={vals.map((v, i) => labels[i] + ", frequency " + v).join(". ")}>
      <text x="9" y="12">Frequency</text>
      {vals.map((v, i) => <g key={i}>
        <rect x={14 + i * width} y={92 - scale * v} width={width} height={scale * v} fill="#a4d6c7" stroke="#386e61" />
        <text x={14 + (i + .5) * width} y={87 - scale * v} textAnchor="middle">{v}</text>
        <text x={14 + (i + .5) * width} y="108" textAnchor="middle">{labels[i]}</text>
      </g>)}
    </svg></ZoomableGraph>;
  }
  if (data.kind === "percent-bar") {
    const colors = ["#317e6c", "#d3a951", "#8fa6d0"];
    return <figure className="mt-data">
      <svg className="mt-chart" viewBox="0 0 240 42" role="img" aria-label={labels.map((l,i) => l + " " + vals[i] + "%").join(", ")}>
        {vals.map((v, i) => <rect key={i} x={vals.slice(0,i).reduce((a,b) => a+b,0) * 2.4} y="6"
          width={v * 2.4} height="26" stroke="white" fill={colors[i]} />)}
      </svg>
      <figcaption>{vals.map((v,i) => labels[i] + " " + v + "%").join(" · ")}</figcaption>
    </figure>;
  }
  if (data.kind === "percent")
    return (
      <div className="mt-data">
        <div className="mt-percent" aria-label={vals[0] + " percent shaded"}>
          {Array.from({ length: 20 }, (_, i) => (
            <i key={i} className={i * 5 < vals[0] ? "on" : ""} />
          ))}
        </div>
        <small>
          {vals[0]}% shaded · total {labels[0]}
        </small>
      </div>
    );
  if (data.kind === "net") {
    const [first, second, a, b, c, d] = vals;
    // Older ranked banks grouped identical lateral faces next to each other.
    const areas = data.solid === 1 && a === b && c === d ? [first, second, a, c, b, d] : vals;
    return <Net solid={data.solid!} areas={areas} />;
  }
  if (data.kind === "faces")
    return (
      <div className="mt-net" aria-label="Face areas">
        {vals.map((v, i) => (
          <span key={i}>
            {i < (data.solid! <= 2 ? 2 : 1) ? "Base" : "Side"}
            <b>{v}</b>
          </span>
        ))}
      </div>
    );
  const total = vals.reduce((a, b) => a + b, 0);
  return (
    <div className="mt-data">
      {data.kind === "pie" && (
        <div
          className="mt-pie"
          style={{ background: `conic-gradient(#317e6c 0 ${(100 * vals[0]) / total}%,#d3a951 0)` }}
        />
      )}
      {vals.map((v, i) => (
        <div className="mt-bar" key={i}>
          <span>{labels[i]}</span>
          {data.kind === "dots" ? (
            <b>{"●".repeat(v)}</b>
          ) : (
            <i style={{ width: `${(60 * v) / Math.max(...vals)}%` }} />
          )}
          <strong>{v}</strong>
        </div>
      ))}
    </div>
  );
}

function Net({ solid, areas }: { solid: number; areas: number[] }) {
  type Face = [string, number, number];
  const rect = (x: number, y: number): Face => [`M${x} ${y}h34v28h-34z`, x + 17, y + 17];
  const layouts: Face[][] = [
    [rect(48, 2), rect(48, 58), rect(14, 30), rect(48, 30), rect(82, 30), rect(116, 30)],
    [
      ["M48 30l17 -25 17 25z", 65, 23],
      ["M48 58l17 25 17 -25z", 65, 72],
      rect(14, 30),
      rect(48, 30),
      rect(82, 30),
    ],
    [
      rect(65, 32),
      ["M65 32l17 -27 17 27z", 82, 24],
      ["M99 32l28 14 -28 14z", 110, 49],
      ["M65 60l17 27 17 -27z", 82, 72],
      ["M65 32l-28 14 28 14z", 54, 49],
    ],
    [
      ["M48 60l20 -34 20 34z", 68, 51],
      ["M48 60l-20 -34h40z", 48, 39],
      ["M68 26h40l-20 34z", 88, 39],
      ["M48 60l20 34 20 -34z", 68, 74],
    ],
  ];
  const bases = solid <= 2 ? 2 : 1;
  return (
    <figure className="mt-data">
      <svg
        viewBox="0 0 165 98"
        className="mt-chart"
        role="img"
        aria-label={areas.map((a, i) => (i < bases ? "Base" : "Lateral face") + " " + a).join(", ")}
      >
        {layouts[solid - 1].map(([d, x, y], i) => (
          <g key={i}>
            <path d={d} fill={i < bases ? "#bfdcca" : "#f5ecd7"} stroke="#698779" />
            <text textAnchor="middle" x={x} y={y} fontSize="7">
              {areas[i]}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>Green faces are bases. Labels give face areas.</figcaption>
    </figure>
  );
}
