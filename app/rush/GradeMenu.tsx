import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { formatRunTime } from "../../lib/mentalist/model";
import { rushGrades, rushLength, type RushBoard, type RushGrade, type RushResult } from "../../lib/rush/model";

function visibleGrade(track: HTMLDivElement) {
  const center = track.getBoundingClientRect().left + track.clientWidth / 2;
  return rushGrades.find((_, index) => {
    const page = track.children[index].getBoundingClientRect();
    return page.left <= center && center < page.right;
  });
}

function snapTo(track: HTMLDivElement, grade: RushGrade) {
  const page = track.children[rushGrades.indexOf(grade)];
  track.scrollLeft += page.getBoundingClientRect().left - track.getBoundingClientRect().left;
}

export function GradeMenu({ grade, starting, onGrade, onStart, onBoard }: {
  grade: RushGrade;
  starting: boolean;
  onGrade: (grade: RushGrade) => void;
  onStart: (grade: RushGrade) => void;
  onBoard: (grade: RushGrade, trigger: HTMLButtonElement) => void;
}) {
  const pages = useRef<HTMLDivElement>(null);
  const currentGrade = useRef(grade);

  useLayoutEffect(() => {
    const track = pages.current!;
    snapTo(track, currentGrade.current);
    const observer = new ResizeObserver(() => snapTo(track, currentGrade.current));
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  function jumpTo(option: RushGrade) {
    currentGrade.current = option;
    snapTo(pages.current!, option);
    onGrade(option);
  }

  return <section className="rush-menu" aria-label="Choose a Rush grade">
    <div ref={pages} className="rush-pages" onScroll={event => {
      const visible = visibleGrade(event.currentTarget);
      if (visible && visible !== currentGrade.current) {
        currentGrade.current = visible;
        onGrade(visible);
      }
    }}>
      {rushGrades.map(option => (
        <section className="rush-theme rush-grade-page" data-grade={option} aria-labelledby={`rush-grade-${option}`}
          aria-hidden={grade !== option} key={option}>
          <div className="rush-grade-board">
            <button className="rush-board-trigger" type="button" aria-haspopup="dialog" disabled={starting}
              tabIndex={grade === option ? 0 : -1} aria-label={`${option}math leaderboard`}
              onClick={event => onBoard(option, event.currentTarget)}>
              <span className="rush-podium" aria-hidden="true"><i /><i /><i /></span>
            </button>
            <h2 className="rush-grade-title" id={`rush-grade-${option}`}>{option}math</h2>
            <GradeArt grade={option} />
            <button className="rush-action" type="button" disabled={starting}
              tabIndex={grade === option ? 0 : -1} onClick={() => onStart(option)}>
              {starting ? "Loading…" : "Start Rush"}
            </button>
          </div>
        </section>
      ))}
    </div>
    <div className="rush-page-nav" role="group" aria-label="Rush grade pages" onKeyDown={event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const next = rushGrades[rushGrades.indexOf(grade) + (event.key === "ArrowLeft" ? -1 : 1)];
      if (!next || starting) return;
      event.preventDefault();
      jumpTo(next);
      event.currentTarget.querySelector<HTMLButtonElement>(`[data-page="${next}"]`)?.focus();
    }}>
      {rushGrades.map(option => (
        <button key={option} type="button" data-page={option} aria-label={`Show ${option}math`}
          aria-current={grade === option ? "page" : undefined} disabled={starting} onClick={() => jumpTo(option)}>
          <span>{option}</span>
        </button>
      ))}
    </div>
  </section>;
}

function GradeArt({ grade }: { grade: RushGrade }) {
  if (grade === 6) return <div className="rush-art" aria-hidden="true">
    <span className="rush-equation">7 × 8 = 56</span>
    <span className="rush-fractions">
      <span className="rush-fraction"><span>1</span><span>2</span></span> +
      <span className="rush-fraction"><span>1</span><span>4</span></span> = ?
    </span>
  </div>;
  if (grade === 7) return <div className="rush-art" aria-hidden="true">
    <div className="rush-triangle">
      <span className="rush-angle-60">60°</span>
      <span className="rush-angle-90">90°</span>
      <span className="rush-angle-30">30°</span>
    </div>
    <div className="rush-circle"><i /><span>r</span></div>
  </div>;
  return <div className="rush-art" aria-hidden="true"><i className="rush-cylinder" /><i className="rush-sphere" /></div>;
}

export function Leaderboard({ grade, board, status, result, close, onAuthRequired, retry }: {
  grade: RushGrade;
  board?: RushBoard;
  status: "loading" | "error" | "expired" | "ready";
  result: RushResult | null;
  close: () => void;
  onAuthRequired: () => void;
  retry: () => void;
}) {
  const records = board?.records ?? [];
  const placeholders = Array.from({ length: Math.max(5 - records.length, 0) }, (_, index) => records.length + index + 1);
  const personalBest = result && records.find(record => record.username === board?.username);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    closeButton.current?.focus();
  }, []);

  return createPortal(<div className="mt-shell rush-leaderboard-layer" onClick={event => {
    if (event.target === event.currentTarget) close();
  }} onKeyDown={event => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
    if (event.key !== "Tab") return;
    const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button");
    if (!buttons?.length) return;
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }}>
    <section ref={panel} className="rush-theme rush-leaderboard-panel" data-grade={grade}
      role="dialog" aria-modal="true" aria-labelledby="rush-leaderboard-title">
      <button ref={closeButton} className="rush-leaderboard-close" type="button" onClick={close} aria-label="Close leaderboard">×</button>
      <h2 id="rush-leaderboard-title">{grade}math leaderboard</h2>
      {!board && status === "expired" && <>
        <p role="alert">Sign in again to see scores.</p>
        <button type="button" onClick={onAuthRequired}>Sign in</button>
      </>}
      {!board && status === "error" && <>
        <p role="alert">Could not load scores.</p>
        <button type="button" onClick={retry}>Retry</button>
      </>}
      {!board && status === "loading" && <p role="status">Loading scores…</p>}
      {result && <p className="rush-board-result">
        <span>This run</span>
        <strong>{result.score}/{rushLength} · {formatRunTime(result.elapsedMs)}</strong>
        {personalBest && <span>Your best rank <strong>#{personalBest.rank}</strong></span>}
      </p>}
      <table className="rush-board-table" aria-labelledby="rush-leaderboard-title">
        <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Score</th><th scope="col">Time</th></tr></thead>
        <tbody>
          {records.map(record => {
            const own = record.username === board?.username;
            return <tr key={record.username} className={own ? "rush-own-record" : undefined}>
              <td>#{record.rank}</td>
              <th scope="row">{record.username}{own && <span className="rush-you"> You</span>}</th>
              <td>{record.score}/{rushLength}</td><td>{formatRunTime(record.elapsedMs)}</td>
            </tr>;
          })}
          {placeholders.map(rank => <tr key={rank} className="rush-empty-record">
            <td>#{rank}</td><th scope="row"><span aria-label="Open spot">—</span></th><td>—</td><td>—</td>
          </tr>)}
        </tbody>
      </table>
    </section>
  </div>, document.body);
}
