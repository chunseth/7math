import type { Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";

export const modeSurfaceColors = {
  menu: "#eaf5f8",
  "grade-6": "#eef5fc",
  "grade-7": "#eef5ef",
  "grade-8": "#f6eef6",
  skills: "#edf3ff",
  crafters: "#f8eee2",
  survivor: "#13201c",
  rush: "#eeeffa",
  rivals: "#241e41",
  play: "#e9f7f9",
  teacher: "#f4f6f5",
  verification: "#f5f7f1",
};

type Mode = keyof typeof modeSurfaceColors;

export function ModeSurface({ mode, children }: { mode: Mode; children: ReactNode }) {
  return (
    <div className="mode-surface" data-theme={mode} style={{ "--mode-surface": modeSurfaceColors[mode] } as CSSProperties}>
      {children}
    </div>
  );
}

export function modeLayout(mode: Mode) {
  return {
    viewport: { themeColor: modeSurfaceColors[mode] } satisfies Viewport,
    Layout({ children }: { children: ReactNode }) {
      return <ModeSurface mode={mode}>{children}</ModeSurface>;
    },
  };
}
