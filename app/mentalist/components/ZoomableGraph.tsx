import { useState, type ReactNode } from "react";

export default function ZoomableGraph({ children }: { children: ReactNode }) {
  const [zoomed, setZoomed] = useState(false);
  return <div className="mt-graph-zoom">
    <button type="button" aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>
      {zoomed ? "Full graph" : "Zoom graph"}
    </button>
    <div className={zoomed ? "mt-graph-scroll" : undefined} role={zoomed ? "region" : undefined}
      aria-label={zoomed ? "Zoomed graph. Scroll to read the graph." : undefined} tabIndex={zoomed ? 0 : undefined}>
      {children}
    </div>
  </div>;
}
