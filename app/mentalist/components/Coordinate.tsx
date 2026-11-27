import { useState } from "react";

type Point = [number, number];
type Window = { label: string; x: [number, number]; y: [number, number] };

export default function Coordinate({ limit, line, drawing, drawingScale, scatter, origin, step, count, disabled, onPick }: {
  limit: number;
  line: boolean;
  drawing: boolean;
  drawingScale: number;
  scatter: boolean;
  origin: number;
  step: number;
  count: number;
  disabled: boolean;
  onPick: (points: string) => void;
}) {
  const negative: [number, number] = [-limit, 0];
  const positive: [number, number] = [0, limit];
  const full: [number, number] = [-limit, limit];
  const half = origin === 0 ? Math.min(limit, Math.round(5 / step)) : Math.max(1, Math.round(limit / 3));
  const fullView: Window = { label: line ? "Full line" : "Full grid", x: full, y: full };
  const windows: Window[] = line ? [
    fullView, { label: origin === 0 ? "Negative side" : "Left half", x: negative, y: full },
    { label: origin === 0 ? "Around zero" : "Middle", x: [-half, half], y: full },
    { label: origin === 0 ? "Positive side" : "Right half", x: positive, y: full },
  ] : [
    fullView,
    { label: "Quadrant I", x: positive, y: positive }, { label: "Quadrant II", x: negative, y: positive },
    { label: "Quadrant III", x: negative, y: negative }, { label: "Quadrant IV", x: positive, y: negative },
  ];
  const [viewIndex, setViewIndex] = useState<number | null>(line ? 0 : null);
  const view = windows[viewIndex ?? 0];
  const [cursor, setCursor] = useState<Point>([0, 0]);
  const [keyboardCursor, setKeyboardCursor] = useState(false);
  const [placed, setPlaced] = useState<Point[]>([]);
  const coordinate = (index: number, start = 0) => Math.round((start + index * step) * 10) / 10;
  const clamp = (value: number, [low, high]: [number, number]) => Math.max(low, Math.min(value, high));

  function chooseView(index: number) {
    const next = windows[index];
    setViewIndex(index);
    setCursor([clamp(cursor[0], next.x), clamp(cursor[1], next.y)]);
    setKeyboardCursor(false);
  }

  function place(x: number, y: number) {
    if (placed.length >= count || (scatter && placed.some(([px, py]) => px === x && py === y))) return;
    const points: Point[] = [...placed, [x, y]];
    setCursor([x, y]);
    setKeyboardCursor(false);
    setPlaced(points);
    if (!scatter && points.length === count) onPick(answer(points));
  }
  const answer = (points: Point[]) => points.map(([x, y]) => [coordinate(x, origin), coordinate(y)].join(",")).join(";");

  const size = 2 * limit;
  const left = limit + view.x[0], right = limit + view.x[1];
  const top = line ? 0 : limit - view.y[1], bottom = line ? 1 : limit - view.y[0];
  const xTicksAbove = view.y[1] === 0;
  const yTicksOnRight = !line && view.x[1] === 0;
  const xTickY = line ? 2.2 : limit + (xTicksAbove ? -.35 : .94);
  const xTitleAtCorner = xTicksAbove || yTicksOnRight;
  const sidePadding = xTitleAtCorner ? 1.8 : 1.5;
  const rightPadding = !line && drawingScale > 1 ? 3 : sidePadding;
  const topPadding = viewIndex === 3 && !line ? 2.2 : 1.3;
  const bottomPadding = viewIndex === 2 && !line ? 2.15 : 1.5;
  const xTicks = ticks(view.x), yTicks = ticks(view.y);
  const drawingPoint = placed.at(-1) ?? (keyboardCursor ? cursor : null);
  const waiting = viewIndex === null;
  const tickText = (i: number, start?: number) => coordinate(i, start) * drawingScale;
  const labelStep = Math.max(1, Math.ceil((view.x[1] - view.x[0]) / 10));
  const everyLabel = (range: [number, number], i: number) => line && step === .1
    ? Math.round(coordinate(i, origin) * 10) % 2 === 0
    : !line && step === .5 ? i % 2 === 0
    : i === range[0] || i === range[1] || i % (drawingScale > 1 ? 5 : labelStep) === 0;

  return <div className="mt-grid">
    {(!line || 2 * limit * step > 1 + Number.EPSILON) && <div className="mt-grid-views" role="group" aria-label={line ? "Number line view" : "Coordinate grid view"}>
      {windows.map((option, i) => <button key={option.label} type="button" aria-pressed={viewIndex === i}
        disabled={disabled} onClick={() => chooseView(i)}>{option.label}</button>)}
    </div>}
    {waiting && <p>Tap a quadrant to zoom in, or choose Full grid to see all four at once.</p>}
    {count > 1 && <p>Point {Math.min(placed.length + 1, count)} of {count}
      {placed.length > 0 && <span className="mt-grid-placed"> · Plotted {placed.map(([x, y]) => `(${coordinate(x)}, ${coordinate(y)})`).join(", ")}</span>}
    </p>}
    <svg
      className={viewIndex ? "mt-grid-zoomed" : undefined}
      key={viewIndex}
      tabIndex={disabled || waiting ? -1 : 0}
      role={waiting ? "img" : "button"}
      aria-label={waiting ? "Overview of four quadrants" : `Coordinate ${coordinate(cursor[0], origin)}, ${coordinate(cursor[1])}. Use arrow keys then Space to place a point.`}
      viewBox={`${left - sidePadding} ${top - topPadding} ${right - left + sidePadding + rightPadding} ${line ? 4.6 : bottom - top + topPadding + bottomPadding}`}
      onClick={event => {
        if (disabled) return;
        const svg = event.currentTarget;
        const transform = svg.getScreenCTM();
        if (!transform) return;
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
        if (waiting) {
          const x = point.x - limit, y = limit - point.y;
          if (Math.abs(x) > limit || Math.abs(y) > limit) return;
          chooseView(Math.abs(x) < .3 || Math.abs(y) < .3 ? 0 : y > 0 ? (x > 0 ? 1 : 2) : (x < 0 ? 3 : 4));
          return;
        }
        place(clamp(Math.round(point.x) - limit, view.x), line ? 0 : clamp(limit - Math.round(point.y), view.y));
      }}
      onKeyDown={event => {
        if (disabled || waiting) return;
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          place(...cursor);
          return;
        }
        const movement: Record<string, Point> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
        if (!Object.hasOwn(movement, event.key)) return;
        event.preventDefault();
        const [dx, dy] = movement[event.key];
        setCursor(([x, y]) => [clamp(x + dx, view.x), line ? 0 : clamp(y + dy, view.y)]);
        setKeyboardCursor(true);
      }}>
      {line ? <>
        <path d={`M${left} .5H${right}`} stroke="#425c58" strokeWidth=".13" />
        {xTicks.map(i => <path key={i}
          d={`M${limit + i} ${step === .1 && !everyLabel(view.x, i) ? ".25V.75" : "0V1"}`}
          stroke="#425c58" strokeWidth={everyLabel(view.x, i) ? ".1" : ".055"} />)}
      </> : <>
        {!waiting && xTicks.map(i => <path key={i} d={`M${limit + i} ${top}V${bottom}`} stroke="#c9dad5" strokeWidth=".055" />)}
        {!waiting && yTicks.map(i => <path key={i} d={`M${left} ${limit - i}H${right}`} stroke="#c9dad5" strokeWidth=".055" />)}
        <path d={`M${limit} ${top}V${bottom}M${left} ${limit}H${right}`} stroke="#425c58" strokeWidth=".13" />
        <text x={yTicksOnRight ? left : right + (xTitleAtCorner ? .8 : .25)}
          y={viewIndex === 2 ? bottom + 1.78 : viewIndex === 3 ? top - 1.22 : xTitleAtCorner ? xTickY : limit - .3}
          fontSize=".7">{drawingScale > 1 ? "x (m)" : "x"}</text>
        <text x={xTicksAbove && !yTicksOnRight ? left : limit} y={xTicksAbove ? bottom + .94 : top - .45}
          textAnchor={yTicksOnRight ? "end" : "start"} fontSize=".7">
          {drawingScale > 1 ? "y (m)" : "y"}
        </text>
        {waiting && [[1, 1, "I"], [-1, 1, "II"], [-1, -1, "III"], [1, -1, "IV"]].map(([x, y, label]) =>
          <text x={limit + Number(x) * size / 4} y={limit - Number(y) * size / 4} key={label} textAnchor="middle" fontSize="1.4">{label}</text>)}
      </>}
      {drawing && drawingPoint && <rect
        x={Math.min(limit, limit + drawingPoint[0])} y={Math.min(limit, limit - drawingPoint[1])}
        width={Math.abs(drawingPoint[0])} height={Math.abs(drawingPoint[1])}
        fill="#bbe0cd" fillOpacity=".55" stroke="#347758" strokeWidth=".15" />}
      {placed.map(([x, y], i) => <circle key={i} cx={x + limit} cy={line ? 0.5 : limit - y} r=".34" fill="#bd751f" />)}
      {!scatter && placed.length >= 2 && <polyline fill="none"
        points={placed.map(([x, y]) => [x + limit, limit - y].join(",")).join(" ")} stroke="#bd751f" strokeWidth=".13" />}
      {keyboardCursor && <circle cx={cursor[0] + limit} cy={line ? .5 : limit - cursor[1]} r=".3" fill="#247762" />}
      {!waiting && xTicks.filter(i => everyLabel(view.x, i)).map(i => <text key={i} x={i + limit}
        y={xTickY} fontSize=".75" textAnchor="middle">{tickText(i, origin)}</text>)}
      {!line && !waiting && yTicks.filter(i => i !== 0 && everyLabel(view.y, i)).map(i => <text key={i}
        x={limit + (yTicksOnRight ? .25 : -.25)} y={limit - i + .23} fontSize=".75"
        textAnchor={yTicksOnRight ? "start" : "end"}>{tickText(i)}</text>)}
    </svg>
    {(scatter || count > 1 && placed.length > 0 && placed.length < count) && <div className="mt-grid-actions">
      <button type="button" disabled={disabled || !placed.length} onClick={() => {
      setPlaced(previous => previous.slice(0, -1));
      setKeyboardCursor(false);
      }}>Undo last point</button>
      {scatter && <button type="button" disabled={disabled || placed.length !== count} onClick={() => onPick(answer(placed))}>Check plot</button>}
    </div>}
  </div>;
}

function ticks([low, high]: [number, number]) {
  return Array.from({ length: high - low + 1 }, (_, i) => low + i);
}
