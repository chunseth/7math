"use client";

import Link from "next/link";
import ConceptAssignments from "../components/ConceptAssignments";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { ArenaSpeedProfile, MatchRow, MatchSpeedStatsRow, ProblemAttempt, Teacher } from "../../lib/database.types";
import { milestoneById, operationArenaById } from "../../lib/gameplay";
import { isSupabaseConfigured, teacherSupabase as supabase } from "../../lib/supabase";

type Student = {
  id: string;
  username: string;
  display_name: string;
};

type SpeedTrend = "up" | "down" | "flat" | null;

type StudentSummary = Student & {
  games: number;
  attempts: number;
  correct: number;
  averageTimeMs: number | null;
  /** Speed tier the student's next battle starts on, from their newest arena profile. */
  speedLabel: string | null;
  speedArena: string | null;
  /** Share of answers under half the clock, most recent battle. */
  fastRate: number | null;
  speedTrend: SpeedTrend;
};

type GameSummary = {
  match: MatchRow;
  student: Student | null;
  problemCount: number;
  accuracy: number;
  averageTimeMs: number | null;
  tone: "mastered" | "developing" | "attention";
};

const RECENT_ATTEMPT_LIMIT = 500;
/** Speed history window. Trends need more than today, unlike the rest of the board. */
const SPEED_HISTORY_DAYS = 30;
const SPEED_HISTORY_LIMIT = 1000;
/** Fast-rate change below this reads as "holding steady" rather than a real move. */
const SPEED_TREND_EPSILON = 0.08;

export default function TeacherDashboard() {
  const [authStatus, setAuthStatus] = useState<"checking" | "signed-out" | "authorized" | "denied">("checking");
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [attempts, setAttempts] = useState<ProblemAttempt[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [speedProfiles, setSpeedProfiles] = useState<ArenaSpeedProfile[]>([]);
  const [speedStats, setSpeedStats] = useState<MatchSpeedStatsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [selectedStudentId, setSelectedStudentId] = useState("all");

  const verifyTeacher = useCallback(async (user: User | null) => {
    if (!supabase || !user) {
      setTeacher(null);
      setAuthStatus("signed-out");
      return;
    }

    const { data, error } = await supabase
      .from("teachers")
      .select()
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      setAuthMessage(error.message);
      setTeacher(null);
      setAuthStatus("denied");
      return;
    }

    if (!data) {
      setAuthMessage("This account is signed in, but it is not an active teacher account.");
      setTeacher(null);
      setAuthStatus("denied");
      return;
    }

    setAuthMessage("");
    setTeacher(data);
    setAuthStatus("authorized");
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthMessage("Supabase is not configured for this environment.");
      setAuthStatus("signed-out");
      return;
    }

    const authClient = supabase;
    void authClient.auth.getUser().then(({ data }) => verifyTeacher(data.user));
    const { data: authListener } = authClient.auth.onAuthStateChange((_event, session) => {
      void verifyTeacher(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, [verifyTeacher]);

  const loadDashboard = useCallback(async () => {
    if (!supabase) {
      setMessage("Supabase is not configured for this environment.");
      setLiveStatus("offline");
      setLoading(false);
      return;
    }

    const today = startOfLocalDayIso();
    const speedSince = daysAgoIso(SPEED_HISTORY_DAYS);
    const [profilesResult, attemptsResult, matchesResult, speedProfilesResult, speedStatsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name")
        .order("display_name"),
      supabase
        .from("problem_attempts")
        .select()
        .gte("created_at", today)
        .order("created_at", { ascending: false })
        .limit(RECENT_ATTEMPT_LIMIT),
      supabase
        .from("matches")
        .select()
        .gte("created_at", today)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("arena_speed_profiles")
        .select()
        .order("last_battle_at", { ascending: false }),
      supabase
        .from("match_speed_stats")
        .select()
        .gte("created_at", speedSince)
        .order("created_at", { ascending: false })
        .limit(SPEED_HISTORY_LIMIT),
    ]);

    const firstError = profilesResult.error ?? attemptsResult.error ?? matchesResult.error;
    if (firstError) throw firstError;

    setStudents((profilesResult.data ?? []) as Student[]);
    setAttempts(attemptsResult.data ?? []);
    setMatches(matchesResult.data ?? []);
    // Speed tables are additive; a deployment that has not run the migration yet
    // should still render the rest of the dashboard.
    setSpeedProfiles(speedProfilesResult.error ? [] : speedProfilesResult.data ?? []);
    setSpeedStats(speedStatsResult.error ? [] : speedStatsResult.data ?? []);
  }, []);

  useEffect(() => {
    if (authStatus !== "authorized") return;
    setLoading(true);
    loadDashboard()
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Could not load the dashboard.");
        setLiveStatus("offline");
      })
      .finally(() => setLoading(false));
  }, [authStatus, loadDashboard]);

  useEffect(() => {
    if (!supabase || authStatus !== "authorized") return;
    const realtimeClient = supabase;

    const channel = realtimeClient
      .channel("teacher-dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "problem_attempts" },
        (payload) => {
          const attempt = payload.new as ProblemAttempt;
          setAttempts((current) => [attempt, ...current.filter((item) => item.id !== attempt.id)].slice(0, RECENT_ATTEMPT_LIMIT));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches" },
        (payload) => {
          const match = payload.new as MatchRow;
          setMatches((current) => [match, ...current.filter((item) => item.id !== match.id)].slice(0, 200));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          const profile = payload.new as Student;
          if (!profile.id) return;
          setStudents((current) => [...current.filter((student) => student.id !== profile.id), profile]
            .sort((a, b) => displayStudentName(a).localeCompare(displayStudentName(b))));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveStatus("live");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLiveStatus("offline");
      });

    return () => {
      void realtimeClient.removeChannel(channel);
    };
  }, [authStatus]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setAuthLoading(true);
    setAuthMessage("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setAuthMessage(error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message);
      setAuthLoading(false);
      return;
    }

    await verifyTeacher(data.user);
    setPassword("");
    setAuthLoading(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setTeacher(null);
    setStudents([]);
    setAttempts([]);
    setMatches([]);
    setAuthStatus("signed-out");
    setEmail("");
    setPassword("");
    setMessage("");
  }

  const filteredAttempts = useMemo(
    () => selectedStudentId === "all" ? attempts : attempts.filter((attempt) => attempt.profile_id === selectedStudentId),
    [attempts, selectedStudentId],
  );
  const summaries = useMemo(
    () => buildStudentSummaries(students, attempts, matches, speedProfiles, speedStats),
    [students, attempts, matches, speedProfiles, speedStats],
  );
  const studentMap = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const totalCorrect = filteredAttempts.filter((attempt) => attempt.is_correct).length;
  const accuracy = filteredAttempts.length ? Math.round((totalCorrect / filteredAttempts.length) * 100) : 0;
  const timedAttempts = filteredAttempts.filter((attempt) => attempt.time_ms !== null && attempt.is_correct);
  const averageTimeMs = timedAttempts.length
    ? Math.round(timedAttempts.reduce((sum, attempt) => sum + (attempt.time_ms ?? 0), 0) / timedAttempts.length)
    : null;
  const activeStudentIds = new Set(attempts.map((attempt) => attempt.profile_id));
  const filteredMatches = selectedStudentId === "all" ? matches : matches.filter((match) => match.profile_id === selectedStudentId);
  const gameSummaries = useMemo(
    () => buildGameSummaries(filteredMatches, attempts, studentMap),
    [attempts, filteredMatches, studentMap],
  );

  if (authStatus !== "authorized") {
    return (
      <main className="teacher-auth-shell">
        <Link className="teacher-auth-home" href="/">← Student arena</Link>
        <section className="teacher-auth-card" aria-labelledby="teacher-signin-title">
          <h1 id="teacher-signin-title">7Math Teacher</h1>
          <p className="teacher-auth-copy">Sign in to view student activity.</p>

          {authStatus === "checking" ? (
            <div className="teacher-auth-checking"><span /> Checking your session…</div>
          ) : (
            <form onSubmit={signIn}>
              <label>
                <span>Email address</span>
                <input
                  autoComplete="email"
                  inputMode="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teacher@school.org"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  autoComplete="current-password"
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  required
                  type="password"
                  value={password}
                />
              </label>
              {authMessage && <p className="teacher-auth-error" role="alert">{authMessage}</p>}
              <button disabled={authLoading || !isSupabaseConfigured} type="submit">
                {authLoading ? "SIGNING IN…" : "SIGN IN"}
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="teacher-shell">
      <header className="teacher-header">
        <Link className="teacher-brand" href="/">7Math <span>Teacher</span></Link>
        <div className="teacher-account">
          <strong>{teacher?.display_name}</strong>
          <div className={`live-pill ${liveStatus}`}>
            <span aria-hidden="true" />
            {liveStatus === "live" ? "Live" : liveStatus === "connecting" ? "Connecting" : "Offline"}
          </div>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="teacher-toolbar" aria-label="Dashboard controls">
        <h1>Today</h1>
        <label>
          <span>Student</span>
          <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
            <option value="all">All students</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{displayStudentName(student)}</option>
            ))}
          </select>
        </label>
      </section>

      {message && <div className="teacher-notice">{message}</div>}

      <section className="teacher-stats" aria-label="Today’s summary">
        <div><strong>{activeStudentIds.size}</strong><span>Active students</span></div>
        <div><strong>{filteredMatches.length}</strong><span>Games</span></div>
        <div><strong>{accuracy}%</strong><span>Correct</span></div>
        <div><strong>{averageTimeMs === null ? "—" : formatDuration(averageTimeMs)}</strong><span>Average pace</span></div>
      </section>

      {teacher && <ConceptAssignments students={students} teacherId={teacher.id} />}

      <section className="teacher-content">
        <div className="teacher-panel student-panel">
          <div className="panel-heading">
            <h2>Students</h2>
            <span>{loading ? "Loading…" : `${summaries.length} students`}</span>
          </div>

          <div className="student-table" role="table" aria-label="Student performance">
            <div className="student-row student-table-head" role="row">
              <span>Student</span><span>Games</span><span>Accuracy</span><span>Pace</span><span>Speed tier</span><span>Status</span>
            </div>
            {summaries.map((student) => {
              const studentAccuracy = student.attempts ? Math.round((student.correct / student.attempts) * 100) : null;
              const status = getStudentStatus(studentAccuracy, student.attempts);
              return (
                <button
                  className="student-row"
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  role="row"
                >
                  <strong>@{student.username || displayStudentName(student)}</strong>
                  <span>{student.games}</span>
                  <span>{studentAccuracy === null ? "—" : `${studentAccuracy}%`}</span>
                  <span>{student.averageTimeMs === null ? "—" : formatDuration(student.averageTimeMs)}</span>
                  <span
                    className="speed-cell"
                    title={
                      student.speedLabel
                        ? `Next ${student.speedArena} battle starts on ${student.speedLabel}${
                            student.fastRate === null ? "" : ` · ${Math.round(student.fastRate * 100)}% fast answers last battle`
                          }`
                        : "No speed data yet"
                    }
                  >
                    {student.speedLabel ?? "—"}
                    {student.speedTrend && (
                      <i className={`speed-trend ${student.speedTrend}`} aria-label={`Speed trending ${student.speedTrend}`}>
                        {speedTrendGlyph(student.speedTrend)}
                      </i>
                    )}
                  </span>
                  <span><i className={`status-chip ${status.tone}`}>{status.label}</i></span>
                </button>
              );
            })}
            {!loading && summaries.length === 0 && <div className="empty-dashboard">No student profiles yet.</div>}
          </div>
        </div>

        <aside className="teacher-panel game-panel">
          <div className="panel-heading">
            <h2>Recent games</h2>
            <span>{gameSummaries.length} today</span>
          </div>

          <div className="game-summary-grid" aria-live="polite">
            {gameSummaries.map(({ match, student, problemCount, accuracy: gameAccuracy, averageTimeMs: gameAverageTime, tone }) => {
              const statusLabel = tone === "mastered" ? "Doing well" : tone === "developing" ? "Developing" : "Review";
              const username = student?.username || student?.display_name || "student";
              return (
                <article className={`game-summary-row ${tone}`} key={match.id}>
                  <div>
                    <strong>@{username}</strong>
                    <time dateTime={match.created_at}>{formatGameTime(match.created_at)}</time>
                    <small>{formatOperations(match.operations)}</small>
                  </div>
                  <strong>{match.correct_count}/{problemCount} <span>· {gameAccuracy}%</span></strong>
                  <span>{gameAverageTime === null ? "—" : `${formatDuration(gameAverageTime)} avg`}</span>
                  <i className={`status-chip ${tone === "mastered" ? "success" : tone === "developing" ? "warning" : "danger"}`}>{statusLabel}</i>
                </article>
              );
            })}
            {!loading && gameSummaries.length === 0 && (
              <div className="empty-dashboard">Game summaries will appear when students finish a match.</div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function buildStudentSummaries(
  students: Student[],
  attempts: ProblemAttempt[],
  matches: MatchRow[],
  speedProfiles: ArenaSpeedProfile[],
  speedStats: MatchSpeedStatsRow[],
): StudentSummary[] {
  return students.map((student) => {
    const studentAttempts = attempts.filter((attempt) => attempt.profile_id === student.id);
    const correctAttempts = studentAttempts.filter((attempt) => attempt.is_correct);
    const timedAttempts = correctAttempts.filter((attempt) => attempt.time_ms !== null);
    // Newest arena profile: the tier this student's next battle would open on.
    const newestProfile = speedProfiles
      .filter((profile) => profile.profile_id === student.id && profile.last_battle_at)
      .sort((a, b) => (b.last_battle_at ?? "").localeCompare(a.last_battle_at ?? ""))[0] ?? null;
    const history = speedStats
      .filter((row) => row.profile_id === student.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    return {
      ...student,
      games: matches.filter((match) => match.profile_id === student.id).length,
      attempts: studentAttempts.length,
      correct: correctAttempts.length,
      averageTimeMs: timedAttempts.length
        ? Math.round(timedAttempts.reduce((sum, attempt) => sum + (attempt.time_ms ?? 0), 0) / timedAttempts.length)
        : null,
      speedLabel: newestProfile ? milestoneById(newestProfile.carry_milestone_id).label : null,
      speedArena: newestProfile ? operationArenaById(newestProfile.arena_id).title : null,
      fastRate: history[0]?.fast_rate ?? (newestProfile ? newestProfile.last_fast_rate : null),
      speedTrend: speedTrendOf(history),
    };
  }).sort((a, b) => {
    if (a.attempts === 0 && b.attempts > 0) return 1;
    if (b.attempts === 0 && a.attempts > 0) return -1;
    const aAccuracy = a.attempts ? a.correct / a.attempts : 1;
    const bAccuracy = b.attempts ? b.correct / b.attempts : 1;
    return aAccuracy - bAccuracy;
  });
}

function buildGameSummaries(matches: MatchRow[], attempts: ProblemAttempt[], students: Map<string, Student>): GameSummary[] {
  return matches.map((match) => {
    const matchAttempts = attempts.filter((attempt) => attempt.match_id === match.id);
    const timedAttempts = matchAttempts.filter((attempt) => attempt.is_correct && attempt.time_ms !== null);
    const problemCount = match.correct_count + match.incorrect_count;
    const accuracy = problemCount ? Math.round((match.correct_count / problemCount) * 100) : 0;
    const tone: GameSummary["tone"] = accuracy < 70 ? "attention" : accuracy >= 85 ? "mastered" : "developing";

    return {
      match,
      student: students.get(match.profile_id) ?? null,
      problemCount,
      accuracy,
      averageTimeMs: timedAttempts.length
        ? Math.round(timedAttempts.reduce((sum, attempt) => sum + (attempt.time_ms ?? 0), 0) / timedAttempts.length)
        : null,
      tone,
    };
  });
}

/**
 * Compare the newest battle's fast-answer rate against the average of the
 * battles before it. Needs at least two battles; small moves read as flat.
 */
function speedTrendOf(history: MatchSpeedStatsRow[]): SpeedTrend {
  if (history.length < 2) return null;
  const [latest, ...previous] = history.slice(0, 6);
  const baseline = previous.reduce((sum, row) => sum + row.fast_rate, 0) / previous.length;
  const delta = latest.fast_rate - baseline;
  if (Math.abs(delta) < SPEED_TREND_EPSILON) return "flat";
  return delta > 0 ? "up" : "down";
}

function speedTrendGlyph(trend: SpeedTrend) {
  if (trend === "up") return "▲";
  if (trend === "down") return "▼";
  if (trend === "flat") return "→";
  return "";
}

function getStudentStatus(accuracy: number | null, attempts: number) {
  if (!attempts) return { label: "Not started", tone: "neutral" };
  if ((accuracy ?? 0) < 70) return { label: "Check in", tone: "danger" };
  if ((accuracy ?? 0) < 85) return { label: "Practicing", tone: "warning" };
  return { label: "On track", tone: "success" };
}

function displayStudentName(student: Pick<Student, "display_name" | "username">) {
  return student.display_name || student.username || "Student";
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function startOfLocalDayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function formatDuration(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function formatGameTime(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function formatOperations(operations: MatchRow["operations"]) {
  if (operations.length !== 1) return "Mixed";
  return operations[0] === "addition"
    ? "Addition"
    : operations[0] === "subtraction"
      ? "Subtraction"
      : operations[0] === "division"
        ? "Division"
        : "Multiplication";
}
