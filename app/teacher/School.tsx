"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { teacherSupabase } from "../../lib/supabase";
import { post } from "../../lib/mentalist/client";
import {
  skills,
  levels,
  levelById,
  skillById,
  type Visual as VisualData,
  type Result,
} from "../../lib/mentalist/model";
import { Visual } from "../mentalist/components/Visual";
import "../mentalist/trail.css";
type Class = { id: string; name: string; timezone: string };
type Student = {
  id: string;
  username: string;
  multiplier: string;
  completed: number;
  knockdowns: number;
  cleared: number;
  accuracy: string | null;
  skill: string | null;
};
type Run = { id: string; level: string; status: string; started: string; result: Result | null };
type Detail = {
  runs: Run[];
  decisions: { id: string; kind: string; skill: string; due: string | null }[];
  clears: { level: string; stars: number }[];
};
type History = {
  run: Run;
  positions: {
    position: number;
    prompt: string;
    answer: string;
    variant: string;
    visual: VisualData | null;
    opened: string | null;
    events: { raw: string; normalized: string; outcome: string; ms: number | null; attempt: number | null }[];
  }[];
};
type Coverage = {
  published: { skill: string; levels: number; sets: number }[];
  requirements: { group: string; requirement: string; levels: string[] }[];
  outstanding: string;
};
const levelName = (id: string) => {
  const l = levelById.get(id);
  return l ? skillById.get(l.skill)!.title + " · " + l.title : id;
};
export default function School() {
  const [token, setToken] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]),
    [cid, setCid] = useState(""),
    [name, setName] = useState(""),
    [tz, setTz] = useState("America/Chicago"),
    [username, setUsername] = useState("");
  const [students, setStudents] = useState<Student[]>([]),
    [student, setStudent] = useState(""),
    [detail, setDetail] = useState<Detail | null>(null),
    [history, setHistory] = useState<History | null>(null),
    [coverage, setCoverage] = useState<Coverage | null>(null);
  const [skill, setSkill] = useState("signed.add"),
    [due, setDue] = useState(""),
    [mult, setMult] = useState("1");
  const generation = useRef(0);
  useEffect(() => {
    const { data } =
      teacherSupabase?.auth.onAuthStateChange((_e, s) => {
        setToken(s?.access_token ?? "");
        if (!s) {
          setClasses([]);
          setCid("");
          setStudents([]);
          setStudent("");
          setDetail(null);
          setHistory(null);
          setCoverage(null);
        }
      }) ?? {};
    return () => data?.subscription.unsubscribe();
  }, []);
  function api<T>(action: string, args: Record<string, unknown> = {}) {
    return post<T>({ scope: "teacher", action, classId: cid, profile: student, ...args }, token);
  }
  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not load class.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!token) return;
    let active = true;
    void work(async () => {
      const list = await api<Class[]>("classes");
      if (active) {
        setClasses(list);
        setCid((id) => (list.some((c) => c.id === id) ? id : (list[0]?.id ?? "")));
      }
    });
    return () => {
      active = false;
    };
  }, [token]);
  useEffect(() => {
    setStudent("");
    setStudents([]);
    setDetail(null);
    setHistory(null);
    setCoverage(null);
    if (!cid) return;
    let active = true;
    void work(async () => {
      const list = await api<Student[]>("roster");
      if (active) setStudents(list);
    });
    return () => {
      active = false;
    };
  }, [cid]);
  async function inspect(s: Student) {
    const g = ++generation.current;
    setStudent(s.id);
    setMult(s.multiplier);
    setHistory(null);
    setDetail(null);
    await work(async () => {
      const d = await api<Detail>("student", { profile: s.id });
      if (g === generation.current) setDetail(d);
    });
  }
  function update(action: string, args: Record<string, unknown> = {}) {
    void work(async () => {
      setDetail(await api<Detail>(action, args));
      setStudents(await api<Student[]>("roster"));
    });
  }
  return (
    <main className="mt-school">
      <Link href="/">← Game modes</Link>
      <h1>Classroom</h1>
      {msg && <p role="alert">{msg}</p>}
      {!token ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void work(async () => {
              if (!teacherSupabase) throw Error("School sign-in is unavailable.");
              const { error } = await teacherSupabase.auth.signInWithPassword({ email, password });
              if (error) throw error;
              setPassword("");
            });
          }}
        >
          <label>
            Teacher email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button disabled={busy}>Sign in</button>
        </form>
      ) : (
        <>
          <button onClick={() => teacherSupabase?.auth.signOut()}>Sign out</button>
          <section>
            <h2>Classes</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void work(async () => {
                  const list = await api<Class[]>("createClass", { name, timezone: tz });
                  setClasses(list);
                  setCid(list.find((c) => !classes.some((x) => x.id === c.id))!.id);
                  setName("");
                });
              }}
            >
              <label>
                Class name
                <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Class timezone
                <input required value={tz} onChange={(e) => setTz(e.target.value)} />
              </label>
              <button disabled={busy}>Create class</button>
            </form>
            {classes.length > 0 && (
              <label>
                Current class
                <select value={cid} onChange={(e) => setCid(e.target.value)}>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>
          {cid && (
            <section>
              <h2>Class overview</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void work(async () => {
                    setStudents(await api<Student[]>("enroll", { username }));
                    setUsername("");
                  });
                }}
              >
                <label>
                  Student username
                  <input required value={username} onChange={(e) => setUsername(e.target.value)} />
                </label>
                <button disabled={busy}>Enroll</button>
              </form>
              <div className="mt-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Student",
                        "Current skill",
                        "Cleared levels",
                        "Recent first try",
                        "Finished",
                        "Knockdowns",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <button disabled={busy} onClick={() => inspect(s)}>
                            {s.username}
                          </button>
                        </td>
                        <td>{skillById.get(s.skill ?? "")?.title ?? "—"}</td>
                        <td>{s.cleared}</td>
                        <td>{s.accuracy === null ? "—" : s.accuracy + "%"}</td>
                        <td>{s.completed}</td>
                        <td>{s.knockdowns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => work(async () => setCoverage(await api<Coverage>("coverage")))}>
                Content coverage
              </button>
            </section>
          )}
          {coverage && (
            <section>
              <h2>Content coverage</h2>
              <p>
                {coverage.published.reduce((sum, s) => sum + s.levels, 0)} / {levels.length} levels published.{" "}
                {coverage.outstanding}
              </p>
              {[...new Set(coverage.requirements.map((row) => row.group))].map((group) => (
                <details key={group}>
                  <summary>{group}</summary>
                  {coverage.requirements
                    .filter((r) => r.group === group)
                    .map((r) => (
                      <p key={r.requirement}>
                        <b>{r.requirement}</b> ·{" "}
                        {r.levels.length ? r.levels.map(levelName).join(", ") : "Outstanding evidence"}
                      </p>
                    ))}
                </details>
              ))}
            </section>
          )}
          {detail && (
            <section>
              <h2>{students.find((s) => s.id === student)?.username}</h2>
              <div className="mt-tools">
                <label>
                  Skill
                  <select value={skill} onChange={(e) => setSkill(e.target.value)}>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Due date
                  <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                </label>
                <button disabled={busy} onClick={() => update("assignment", { skill, due })}>
                  Assign skill
                </button>
                <button disabled={busy} onClick={() => update("placement", { skill })}>
                  Record placement
                </button>
              </div>
              <div className="mt-tools">
                <label>
                  Timing multiplier
                  <input
                    type="number"
                    min=".5"
                    max="4"
                    step=".05"
                    value={mult}
                    onChange={(e) => setMult(e.target.value)}
                  />
                </label>
                <button disabled={busy} onClick={() => update("timing", { multiplier: mult })}>
                  Save timing
                </button>
              </div>
              {detail.decisions.map((d) => (
                <p key={d.id}>
                  {skillById.get(d.skill)?.title} · {d.kind} {d.due && " · " + d.due}{" "}
                  <button onClick={() => update("remove", { decision: d.id })}>Remove</button>
                </p>
              ))}
              <details>
                <summary>Skill map · {detail.clears.length} levels cleared in this class</summary>
                {skills.map((s) => (
                  <p key={s.id}>
                    {s.title} ·{" "}
                    {s.levels
                      .map((_, i) => {
                        const c = detail.clears.find((c) => c.level === s.id + "." + (i + 1));
                        return c ? "★".repeat(c.stars) : "○";
                      })
                      .join(" / ")}
                  </p>
                ))}
              </details>
              <h3>Run history</h3>
              {detail.runs.map((r) => (
                <article key={r.id} className="mt-row">
                  <div>
                    <b>{levelName(r.level)}</b>
                    <p>
                      {new Date(r.started).toLocaleString()} · {r.status}
                    </p>
                    {r.result && (
                      <p>
                        {r.result.firstTry}/12 first try · {r.result.retries} retries ·{" "}
                        {r.result.simplifications} simplifications ·{" "}
                        {r.result.activeMs === null
                          ? "Timing unavailable"
                          : Math.round(r.result.activeMs / 1000) + " s"}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => work(async () => setHistory(await api<History>("run", { run: r.id })))}
                  >
                    Inspect
                  </button>
                </article>
              ))}
            </section>
          )}
          {history && (
            <section>
              <h2>{levelName(history.run.level)}</h2>
              <p>{history.run.status} · 12 positions</p>
              {history.positions.map((p) => {
                const valid = p.events.every((e) => e.ms !== null);
                const scored = p.events.findIndex((e) => e.outcome !== "simplification");
                const elapsed = (count: number) =>
                  count < 1 || p.events.slice(0, count).some((e) => e.ms === null)
                    ? "—"
                    : p.events.slice(0, count).reduce((a, e) => a + e.ms!, 0) + " ms";
                return (
                  <details key={p.position}>
                    <summary>
                      {p.position}. {p.prompt} · {p.opened ? p.events.length + " responses" : "Unseen"}
                    </summary>
                    <Visual data={p.visual ?? undefined} />
                    <p>
                      Answer {p.answer} · {p.variant}
                    </p>
                    <p>
                      First response {elapsed(Math.min(p.events.length, 1))} · First scored{" "}
                      {elapsed(scored + 1)} · Total {valid ? elapsed(p.events.length) : "Unavailable"}
                    </p>
                    <ol>
                      {p.events.map((e, i) => (
                        <li key={i}>
                          {e.raw} → {e.normalized} · {e.outcome} {e.attempt && " · Attempt " + e.attempt}
                        </li>
                      ))}
                    </ol>
                  </details>
                );
              })}
            </section>
          )}
        </>
      )}
    </main>
  );
}
