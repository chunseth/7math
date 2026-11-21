import type { Visual as Data } from "../../../lib/mentalist/model";
import { useState } from "react";
export function Visual({ data, onSimulated }: { data?: Data; onSimulated?: () => void }) {
  const [draws, setDraws] = useState(0);
  if (!data) return null;
  const vals = data.values ?? [],
    labels = data.labels ?? [];
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
          Run next trial
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
  if (data.kind === "plot") {
    const pts = data.points!,
      maxX = Math.max(...pts.map((p) => p[0])),
      maxY = Math.max(...pts.map((p) => p[1]));
    return (
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
      </svg>
    );
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
    const px = (v: number) => 55 + (155 * (v - min)) / (max - min);
    return (
      <div className="mt-data">
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
      </div>
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
  if (data.kind === "balance")
    return (
      <div
        className="mt-data mt-balance"
        aria-label={vals[0] + " boxes plus " + vals[1] + " units equals " + vals[2]}
      >
        <b>{"▣ ".repeat(vals[0])}</b> + {vals[1]} = {vals[2]}
      </div>
    );
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
  if (data.kind === "net") return <Net solid={data.solid!} areas={vals} />;
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
