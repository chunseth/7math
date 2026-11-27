import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { post, RequestError } from "../../lib/mentalist/client";
import { formatRunTime } from "../../lib/mentalist/model";
import { rushGrades, rushLength, type RushBoard, type RushGrade } from "../../lib/rush/model";
import { Sheet } from "../mentalist/components/Sheet";

export function GradeMenu({ grade, starting, onGrade, onStart, onBoard }: {
  grade: RushGrade;
  starting: boolean;
  onGrade: (grade: RushGrade) => void;
  onStart: (grade: RushGrade) => void;
  onBoard: (grade: RushGrade) => void;
}) {
  const pages = useRef<HTMLDivElement>(null);
  const firstGrade = useRef(grade);

  useLayoutEffect(() => {
    const track = pages.current!;
    track.scrollLeft = (firstGrade.current - 6) * track.clientWidth;
  }, []);

  function jumpTo(option: RushGrade) {
    const track = pages.current!;
    track.scrollLeft = (option - 6) * track.clientWidth;
    onGrade(option);
  }

  return <section className="rush-menu" aria-label="Choose a Rush grade">
    <div ref={pages} className="rush-pages" onScroll={event => {
      const track = event.currentTarget;
      const nearest = rushGrades[Math.round(track.scrollLeft / track.clientWidth)];
      if (nearest && nearest !== grade) onGrade(nearest);
    }}>
      {rushGrades.map(option => (
        <section className="rush-grade-page" data-grade={option} aria-labelledby={`rush-grade-${option}`}
          inert={grade !== option} key={option}>
          <div className="rush-grade-board">
            <button className="rush-board-trigger" type="button" aria-haspopup="dialog" disabled={starting}
              aria-label={`${option}math leaderboard`} onClick={() => onBoard(option)}>
              <span className="rush-podium" aria-hidden="true"><i /><i /><i /></span>
            </button>
            <h2 className="rush-grade-title" id={`rush-grade-${option}`}>{option}math</h2>
            <GradeArt grade={option} />
            <button className="rush-action" type="button" disabled={starting} onClick={() => onStart(option)}>
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
          aria-pressed={grade === option} disabled={starting} onClick={() => jumpTo(option)} />
      ))}
    </div>
  </section>;
}

function GradeArt({ grade }: { grade: RushGrade }) {
  if (grade === 6) return <div className="rush-art rush-equation" aria-hidden="true">7 × 8 = 56</div>;
  if (grade === 7) return <div className="rush-art" aria-hidden="true">
    <div className="rush-triangle">
      <span className="rush-angle-60">60°</span>
      <span className="rush-angle-90">90°</span>
      <span className="rush-angle-30">30°</span>
    </div>
  </div>;
  return <div className="rush-art rush-solids" aria-hidden="true"><i className="rush-cylinder" /><i className="rush-sphere" /></div>;
}

export function Leaderboard({ grade, close, onAuthRequired }: {
  grade: RushGrade;
  close: () => void;
  onAuthRequired: () => void;
}) {
  const [board, setBoard] = useState<RushBoard | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    post<RushBoard>({ action: "rushBoard", grade }).then(data => {
      if (active) setBoard(data);
    }).catch(error => {
      if (!active) return;
      if (error instanceof RequestError && error.status === 401) onAuthRequired();
      else setError("Could not load scores.");
    });
    return () => { active = false; };
  }, [grade, revision, onAuthRequired]);

  return <Sheet close={close} labelledBy="rush-leaderboard-title">
    <h2 id="rush-leaderboard-title">{grade}math leaderboard</h2>
    {error ? <>
      <p role="alert">{error}</p>
      <button type="button" onClick={() => { setError(""); setRevision(value => value + 1); }}>Retry</button>
    </> : !board ? <p role="status">Loading scores…</p> :
      !board.records.length ? <p>No scores yet.</p> :
      <table className="mt-leaderboard" aria-labelledby="rush-leaderboard-title">
        <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Score</th><th scope="col">Time</th></tr></thead>
        <tbody>{board.records.map(record => (
          <tr key={record.username} className={record.username === board.username ? "mt-own-record" : undefined}>
            <td>#{record.rank}</td>
            <th scope="row">{record.username}{record.username === board.username && " (you)"}</th>
            <td>{record.score}/{rushLength}</td><td>{formatRunTime(record.elapsedMs)}</td>
          </tr>
        ))}</tbody>
      </table>}
  </Sheet>;
}
