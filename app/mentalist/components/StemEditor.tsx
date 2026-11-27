import { useRef, useState } from "react";

export default function StemEditor({ prompt, labels, disabled, onChange }: {
  prompt: string;
  labels: string[];
  disabled: boolean;
  onChange: (rows: string[]) => void;
}) {
  const values = (/plot for ([\d, ]+)\./.exec(prompt)?.[1] ?? "").split(", ").filter(Boolean).map(Number);
  const [picked, setPicked] = useState<number | null>(null);
  const [placed, setPlaced] = useState<{ index: number; row: number }[]>([]);
  const rows = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const [drag, setDrag] = useState<{ index: number; x: number; y: number } | null>(null);

  function change(next: typeof placed) {
    setPlaced(next);
    onChange(next.length === values.length ? labels.map((_, row) =>
      next.filter(item => item.row === row).map(item => values[item.index] % 10).join(" ")) : []);
  }

  function place(index: number | null, row: number) {
    if (disabled || index === null || placed.some(item => item.index === index)) return;
    change([...placed, { index, row }]);
    setPicked(null);
  }

  return <div className="mt-stem-editor">
    <p>Drag each number to its stem, or select a number and then its stem. Place leaves in order. Tap a leaf to remove it.</p>
    <div className="mt-stem-layout">
      <div className="mt-stem-source"><strong>Numbers to sort</strong>
        <div className="mt-field-buttons" role="group" aria-label="Numbers to sort">
          {values.map((value, index) => placed.some(item => item.index === index) ? null :
            <button key={index} type="button" disabled={disabled} className="mt-stem-token" aria-pressed={picked === index}
              onClick={event => { if (!dragged.current || event.detail === 0) setPicked(index); dragged.current = false; }}
              onPointerDown={event => {
                if (event.button !== 0) return;
                start.current = { x: event.clientX, y: event.clientY };
                dragged.current = false;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={event => {
                if (!start.current || Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) < 6 && !dragged.current) return;
                dragged.current = true;
                setDrag({ index, x: event.clientX, y: event.clientY });
              }}
              onPointerCancel={() => { start.current = null; setDrag(null); }}
              onPointerUp={event => {
                start.current = null;
                setDrag(null);
                if (!dragged.current) return;
                const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-stem-row]");
                if (target && rows.current?.contains(target)) place(index, Number(target.dataset.stemRow));
              }}>{value}</button>)}
        </div>
      </div>
      <div ref={rows} className="mt-stem-rows" role="group" aria-label="Stems">{labels.map((label, row) =>
        <div key={label} className="mt-stem-row" data-stem-row={row}>
          <button type="button" aria-label={label} disabled={disabled} onClick={() => place(picked, row)}>{label}</button>
          {placed.filter(item => item.row === row).map(({ index }) => <button type="button" key={index} disabled={disabled}
            aria-label={"Remove leaf " + values[index] % 10 + " from " + label.toLowerCase()}
            onClick={() => change(placed.filter(item => item.index !== index))}>{values[index] % 10}</button>)}
        </div>)}</div>
    </div>
    {drag && <span className="mt-stem-drag" aria-hidden="true" style={{ left: drag.x, top: drag.y }}>{values[drag.index]}</span>}
  </div>;
}
