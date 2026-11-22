"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { complete, type Control } from "../../../lib/mentalist/model";
export default function Answer({
  control: c,
  disabled,
  onAnswer,
}: {
  control: Control;
  disabled: boolean;
  onAnswer: (raw: string) => void;
}) {
  const [value, setValue] = useState(""),
    [den, setDen] = useState(""),
    [field, setField] = useState(0);
  const [parts, setParts] = useState<string[]>([]),
    [revision, setRevision] = useState(0);
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
  const fraction = c.kind === "fraction",
    numeric = ["whole", "fraction", "decimal"].includes(c.kind);
  const raw = c.fields
    ? c.fields.map((_, i) => parts[i] ?? "").join("|")
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
    if (!ready || sent.current === revision) return;
    if (!fraction) {
      check();
      return;
    }
    const timer = setTimeout(check, 800);
    return () => clearTimeout(timer);
  }, [check, ready, revision, fraction]);
  function edit(key: string) {
    if (disabled) return;
    if (key === "/" && fraction) {
      setField(1);
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
      if (e.ctrlKey || e.metaKey || e.altKey) return;
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
        {c.kind === "ray" && parts[0] && (
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
        )}
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
        {c.fields.map((f, i) => (
          <label key={i}>
            {f.label}
            <select
              disabled={disabled}
              value={parts[i] ?? ""}
              onChange={(e) => {
                const a = [...parts];
                a[i] = e.target.value;
                setParts(a);
                setRevision((r) => r + 1);
              }}
            >
              <option value="">Choose…</option>
              {f.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );
  if (c.limit)
    return (
      <Coordinate
        step={c.step ?? 1}
        count={c.points ?? 1}
        limit={c.limit}
        line={c.kind === "line"}
        drawing={c.kind === "drawing"}
        disabled={disabled}
        onPick={(points) => {
          setValue(points);
          setRevision((i) => i + 1);
        }}
      />
    );
  return (
    <div className="mt-entry">
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
          <output>{value || "□".repeat(c.width ?? 1) + (c.places ? "." + "□".repeat(c.places) : "")}</output>
        )}
      </div>
      <div className="mt-keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "Backspace"].map((k) => (
          <button type="button" key={k} disabled={disabled} onClick={() => edit(k)} aria-label={k}>
            {k === "Backspace" ? "⌫" : k}
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
        {fraction && (
          <button disabled={disabled} onClick={() => setField(1 - field)}>
            {field === 0 ? "Denominator" : "Numerator"}
          </button>
        )}
        {fraction && <button disabled={!ready || sent.current === revision} onClick={check}>Check answer</button>}
      </div>
    </div>
  );
}
function Coordinate({
  limit,
  line,
  drawing,
  step,
  count,
  disabled,
  onPick,
}: {
  limit: number;
  line: boolean;
  drawing: boolean;
  step: number;
  count: number;
  disabled: boolean;
  onPick: (points: string) => void;
}) {
  const [x, setX] = useState(0),
    [y, setY] = useState(0);
  const [placed, setPlaced] = useState<[number, number][]>([]);
  function place(x: number, y: number) {
    const points: [number, number][] = [...placed, [x, y]];
    setX(x);
    setY(y);
    setPlaced(points);
    if (points.length === count) onPick(points.map(([x, y]) => [x * step, y * step].join(",")).join(";"));
  }
  // Focusable graph supports pointer selection and keyboard placement.
  const size = 2 * limit;
  return (
    <div className="mt-grid">
      {count > 1 && (
        <p>
          Point {Math.min(placed.length + 1, count)} of {count}
        </p>
      )}
      <svg
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label={`Coordinate ${x * step}, ${y * step}. Use arrow keys then Space to place a point.`}
        viewBox={`-1 -1 ${size + 2} ${line ? 4 : size + 2}`}
        onClick={(e) => {
          if (disabled) return;
          const svg = e.currentTarget,
            pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const m = svg.getScreenCTM();
          if (!m) return;
          const p = pt.matrixTransform(m.inverse());
          place(
            Math.max(-limit, Math.min(limit, Math.round(p.x) - limit)),
            line ? 0 : Math.max(-limit, Math.min(limit, limit - Math.round(p.y))),
          );
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key.startsWith("Arrow") || e.key === " " || e.key === "Enter") e.preventDefault();
          if (e.key === "ArrowLeft") setX(Math.max(-limit, x - 1));
          if (e.key === "ArrowRight") setX(Math.min(limit, x + 1));
          if (!line && e.key === "ArrowUp") setY(Math.min(limit, y + 1));
          if (!line && e.key === "ArrowDown") setY(Math.max(-limit, y - 1));
          if (e.key === " " || e.key === "Enter") place(x, y);
        }}
      >
        {Array.from({ length: size + 1 }, (_, i) => (
          <g key={i} stroke={i === limit ? "#425c58" : "#c9dad5"} strokeWidth={i === limit ? 0.13 : 0.055}>
            <path d={`M${i} 0V${line ? 1 : size}`} />
            {!line && <path d={`M0 ${i}H${size}`} />}
          </g>
        ))}
        {line && <path d={`M0 .5H${size}`} stroke="currentColor" strokeWidth=".12" />}
        {drawing && (
          <rect
            x={Math.min(limit, limit + x)}
            y={Math.min(limit, limit - y)}
            width={Math.abs(x)}
            height={Math.abs(y)}
            fill="#bbe0cd"
            fillOpacity=".55"
            stroke="#347758"
            strokeWidth=".15"
          />
        )}
        {placed.map(([gx, gy], i) => (
          <circle key={i} cx={gx + limit} cy={line ? 0.5 : limit - gy} r=".34" fill="#bd751f" />
        ))}
        {placed.length === 2 && (
          <path
            d={`M${placed[0][0] + limit} ${limit - placed[0][1]}L${placed[1][0] + limit} ${limit - placed[1][1]}`}
            stroke="#bd751f"
            strokeWidth=".13"
          />
        )}
        <circle cx={x + limit} cy={line ? 0.5 : limit - y} r=".3" fill="#247762" />
        {[-limit, 0, limit].map((i) => (
          <text key={i} x={i + limit} y={line ? 2 : limit + 1} fontSize=".85" textAnchor="middle">
            {i * step}
          </text>
        ))}
      </svg>
    </div>
  );
}
