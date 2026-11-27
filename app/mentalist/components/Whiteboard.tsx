import { useRef, type PointerEvent } from "react";

export default function Whiteboard() {
  const board = useRef<HTMLCanvasElement>(null);
  const stroke = useRef<{ pointer: number; x: number; y: number } | null>(null);

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    const current = stroke.current;
    if (current && current.pointer !== event.pointerId) return;
    const canvas = event.currentTarget;
    const box = canvas.getBoundingClientRect();
    const x = (event.clientX - box.left) * canvas.width / box.width;
    const y = (event.clientY - box.top) * canvas.height / box.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#193a36";
    context.beginPath();
    context.moveTo(current?.x ?? x - .1, current?.y ?? y);
    context.lineTo(x, y);
    context.stroke();
    stroke.current = { pointer: event.pointerId, x, y };
  }

  return <details className="mt-whiteboard">
    <summary>Whiteboard</summary>
    <canvas ref={board} width={640} height={320} aria-label="Draw scratch work here"
      onPointerDown={event => {
        if (event.button !== 0 || stroke.current) return;
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
        event.currentTarget.setPointerCapture(event.pointerId);
        draw(event);
      }}
      onPointerMove={event => { if (stroke.current) draw(event); }}
      onPointerCancel={() => { stroke.current = null; }}
      onContextMenu={event => event.preventDefault()}
      onLostPointerCapture={event => { if (stroke.current?.pointer === event.pointerId) stroke.current = null; }} />
    <button type="button" onClick={() => {
      const canvas = board.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }}>Clear whiteboard</button>
  </details>;
}
