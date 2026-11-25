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
  const stemRows = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function leaves(row: number, items = placed) {
    return items.filter(item => item.row === row).map(item => values[item.index] % 10).join(" ");
  }
  function change(next: typeof placed) {
    setPlaced(next);
    onChange(next.length === values.length ? labels.map((_, row) => leaves(row, next)) : []);
  }
  function place(index: number | null, row: number) {
    if (disabled || index === null || !Number.isInteger(index) || index < 0 || index >= values.length || placed.some(item => item.index === index)) return;
    change([...placed, { index, row }]);
    setPicked(null);
  }

  return <div className="mt-stem-editor">
    <p>Drag each number to its stem, or tap a number and then a stem. Place leaves in order.</p>
    <div className="mt-stem-layout">
      <div ref={stemRows} className="mt-stem-rows" role="group" aria-label="Stems">{labels.map((label, row) => <button key={label} type="button" disabled={disabled} data-stem-row={row}
        onClick={() => place(picked, row)} onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault();
          const index = event.dataTransfer.getData("application/x-7math-stem");
          if (index) place(Number(index), row);
        }}><strong>{label}</strong><span>{leaves(row) || "—"}</span></button>)}</div>
      <div className="mt-field-buttons" role="group" aria-label="Numbers to place">{values.map((value, index) => placed.some(item => item.index === index) ? null :
        <button key={index} type="button" disabled={disabled} className="mt-stem-token" aria-pressed={picked === index} draggable={!disabled}
          onClick={() => setPicked(index)} onDragStart={event => event.dataTransfer.setData("application/x-7math-stem", String(index))}
          onPointerDown={event => {
            if (event.pointerType === "touch") touchStart.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerCancel={() => { touchStart.current = null; }}
          onPointerUp={event => {
            const start = touchStart.current;
            touchStart.current = null;
            if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10) return;
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>("[data-stem-row]");
            if (target && stemRows.current?.contains(target)) place(index, Number(target.dataset.stemRow));
          }}>{value}</button>)}</div>
    </div>
    <button type="button" disabled={disabled || !placed.length} onClick={() => change(placed.slice(0, -1))}>Undo last leaf</button>
  </div>;
}
