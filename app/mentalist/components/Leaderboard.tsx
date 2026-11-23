"use client";
import { useEffect, useState } from "react";
import { post } from "../../../lib/mentalist/client";
import { formatRunTime, courses, gradeOf, mainPathLevels, skillById, type LevelRecord } from "../../../lib/mentalist/model";
import { Sheet } from "./Sheet";

function Scores({ level, username }: { level: string; username: string }) {
  const [records, setRecords] = useState<LevelRecord[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [sort, setSort] = useState<"totalRank" | "problemRank">("totalRank");
  useEffect(() => {
    let current = true;
    post<LevelRecord[]>({ action: "leaderboard", level })
      .then(data => { if (current) setRecords(data); })
      .catch(e => { if (current) setError(e instanceof Error ? e.message : "Could not load scores."); });
    return () => { current = false; };
  }, [level, attempt]);
  if (error) return <div role="alert"><p>{error}</p><button onClick={() => {
    setError("");
    setAttempt(n => n + 1);
  }}>Retry</button></div>;
  if (!records) return <p role="status">Loading scores…</p>;
  if (!records.length) return <p>No three-star finishes yet. Earn 3 stars to set the first time.</p>;
  const sorted = [...records].sort((a, b) => a[sort] - b[sort] || a.username.localeCompare(b.username));
  return <>
    <p>Personal bests from three-star finishes. Choose a time column to sort fastest first.</p>
    <table className="mt-leaderboard" aria-label="Level leaderboard, fastest first">
      <thead><tr>
        <th scope="col">Rank</th><th scope="col">Student</th>
        {(["totalRank", "problemRank"] as const).map(metric =>
          <th key={metric} scope="col" aria-sort={sort === metric ? "ascending" : undefined}>
            <button onClick={() => setSort(metric)}>
              {metric === "totalRank" ? "Total time" : "Fastest problem"}{sort === metric && <span aria-hidden="true"> ↑</span>}
            </button>
          </th>
        )}
      </tr></thead>
      <tbody>{sorted.map(row => <tr key={row.username} className={row.username === username ? "mt-own-record" : undefined}>
        <td>#{row[sort]}</td><th scope="row">{row.username}{row.username === username && " (you)"}</th>
        <td>{formatRunTime(row.totalMs)}</td><td>{formatRunTime(row.fastestProblemMs)}</td>
      </tr>)}</tbody>
    </table>
  </>;
}

export function Leaderboard({ initialLevel, username, close }: {
  initialLevel: string; username: string; close: () => void;
}) {
  const [level, setLevel] = useState(initialLevel);
  const grade = gradeOf(initialLevel);
  return <Sheet close={close}>
    <h2>Level leaderboard</h2>
    <label htmlFor="mt-board-level">Level</label>
    <select id="mt-board-level" value={level} onChange={e => setLevel(e.target.value)}>
      {(grade === 7 ? mainPathLevels : courses[grade].levels).map(l => <option key={l.id} value={l.id}>{skillById.get(l.skill)!.title} · {l.title}</option>)}
    </select>
    <Scores key={level} level={level} username={username} />
  </Sheet>;
}
