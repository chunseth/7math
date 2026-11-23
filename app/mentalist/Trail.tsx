"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  accessMap,
  checkpoint,
  courses,
  type CourseGrade,
  gradeOf,
  currentSkill,
  levelById,
  mainPathProgress,
  playable,
  skillById,
  type StudentState,
} from "../../lib/mentalist/model";
import type { LevelPack, RoundDraft, StartedRound } from "../../lib/mentalist/round";
import { post, RequestError, restoreRound, storeRound } from "../../lib/mentalist/client";
import { CourseMap, Connections } from "../8math/CourseMap";
import { Practice } from "../8math/Practice";
import { CourseFeed, LessonVideo, PreviewFeed } from "./components/PreviewFeed";
import { previewGoal } from "../../lib/mentalist/preview-goals";
import previews from "../../content/mentalist/previews.json";
import { CurriculumMap } from "./components/CurriculumMap";
import { Leaderboard } from "./components/Leaderboard";
import { Sheet } from "./components/Sheet";
import { Battle } from "./components/Battle";
import { Inventory, Rewards } from "./components/Inventory";
import { emptyCredentials, PlayerFields } from "./components/PlayerFields";
import { Visual } from "./components/Visual";
import "./trail.css";

export default function Trail({
  grade = 7,
  accounts = true,
  initialStudent,
  published,
  initialTab = "Map",
}: {
  grade?: CourseGrade;
  accounts?: boolean;
  initialStudent: StudentState | null;
  published: string[];
  initialTab?: "Map" | "More Topics" | "Collection";
}) {
  const course = grade === 7 ? undefined : courses[grade];
  const path = course?.levels;
  const [practice, setPractice] = useState<string | null>(null);
  const [state, setState] = useState<StudentState | null>(initialStudent),
    [run, setRun] = useState<RoundDraft | null>(null),
    [tab, setTab] = useState<string>(initialTab),
    [selected, select] = useState<string | null>(null);
  const [boardLevel, setBoardLevel] = useState<string | null>(null);
  const [auth, setAuth] = useState(false),
    [create, setCreate] = useState(false),
    [credentials, setCredentials] = useState(emptyCredentials),
    [account, setAccount] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [retry, setRetry] = useState(false);
  const pending = useRef<null | (() => Promise<void>)>(null),
    lock = useRef(false);
  const [publicAccess, setPublicAccess] = useState(() =>
    accessMap(new Set(published), [], new Set(), new Set(), new Set(), path),
  );
  const access = state?.access ?? publicAccess,
    byId = new Map(access.map((a) => [a.id, a])),
    main = mainPathProgress(access, path);
  const requestedGoal = useRef<string | null>(null);
  const pinKey = state && !course ? "mentalist:preview-goal:" + state.profile.id : null;
  const [savedPin, setSavedPin] = useState<{ key: string; skill: string } | null>(null);
  const pinned = savedPin?.key === pinKey ? savedPin?.skill : null;
  const goal = pinned ? previewGoal(pinned, access) : null;
  useEffect(() => {
    if (!pinKey) return;
    try {
      const stored = localStorage.getItem(pinKey);
      setSavedPin(stored && previews.some(clip => clip.skill === currentSkill(stored)) ? {key: pinKey, skill: currentSkill(stored)} : null);
    } catch { /* The current visit can use the in-memory pin. */ }
  }, [pinKey]);
  const packs = useRef(new Map<string, Promise<LevelPack>>());
  function prepare(profile: string, level: string) {
    const key = profile + "/" + level;
    let pack = packs.current.get(key);
    if (!pack) {
      pack = post<LevelPack>({ action: "prepareLevel", level }).catch(error => {
        packs.current.delete(key);
        throw error;
      });
      packs.current.set(key, pack);
    }
    return pack;
  }
  useEffect(() => {
    if (state && main.next && !run && tab === "Map")
      void prepare(state.profile.id, main.next).catch(() => {});
  }, [state?.profile.id, main.next, run, tab]);
  const activeGrade = state?.activeLevel ? gradeOf(state.activeLevel) : grade;
  const playerId = state?.profile.id;
  const allowRestore = initialTab !== "Collection" || tab === "Map";
  const restoredPlayer = useRef<string | null>(null);
  useEffect(() => {
    if (!playerId) restoredPlayer.current = null;
    else if (allowRestore && restoredPlayer.current !== playerId) {
      restoredPlayer.current = playerId;
      const saved = restoreRound(playerId, state?.activeRun ?? null);
      if (saved && gradeOf(saved.run.level) === grade) setRun(saved);
    }
  }, [playerId, allowRestore, state?.activeRun]);
  function saveGoal(key: string, skill: string | null) {
    setSavedPin(skill ? { key, skill } : null);
    try {
      if (skill) localStorage.setItem(key, skill);
      else localStorage.removeItem(key);
    } catch { setMessage("Your goal will stay pinned for this visit."); }
  }
  function openPreviewLevel(skill: string, student: StudentState) {
    const target = previewGoal(skill, student.access);
    if (!target.quick || !target.next) {
      setMessage("Your progress has changed. Choose a skill from your updated feed.");
      return;
    }
    saveGoal("mentalist:preview-goal:" + student.profile.id, skill);
    void prepare(student.profile.id, target.next).catch(() => {});
    select(target.next);
  }
  function tryPreview(skill: string, level = skill + ".1") {
    if (course) {
      if (state && playable(byId.get(level)!)) void prepare(state.profile.id, level).catch(() => {});
      select(level);
      return;
    }
    if (state) openPreviewLevel(skill, state);
    else {
      requestedGoal.current = skill;
      setAuth(true);
    }
  }
  useEffect(() => {
    if (tab === "Map" && !run && (main.next || main.target)) {
      document.getElementById("stop-" + (main.next ?? main.target))?.scrollIntoView({ block: "center" });
    }
  }, [tab, run, main.next, main.target]);
  async function request(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setRetry(false);
    setMessage("");
    try {
      await work();
      pending.current = null;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Connection lost.");
      setMessage(err.message);
      if (!(e instanceof RequestError) || e.status >= 500) {
        pending.current = work;
        setRetry(true);
      } else if (e.status === 401) {
        setAuth(true);
        setState(null);
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function enter(id: string, previous = state?.activeRun ?? null) {
    if (!state) {
      setAuth(true);
      return;
    }
    const player = state.profile.id;
    let pack: LevelPack | undefined;
    const requestId = crypto.randomUUID();
    void request(async () => {
      pack ??= await prepare(player, id);
      const body = { action: "start", id: requestId, level: id, previous, prepared: pack.set };
      let started: StartedRound;
      try { started = await post<StartedRound>(body); }
      catch (error) {
        if (error instanceof RequestError && error.status === 409) {
          packs.current.delete(player + "/" + id);
          pack = undefined;
        }
        throw error;
      }
      packs.current.delete(player + "/" + id);
      const draft: RoundDraft = { run: started, pack, attempts: [], started: Date.now(), activeMs: 0, save: null };
      storeRound(player, draft);
      setRun(draft);
      select(null);
    });
  }
  function openLeaderboard(level: string) {
    setBoardLevel(level);
    if (!state) setAuth(true);
  }
  function act(action: string, value: string) {
    const body = { action, value, grade, id: crypto.randomUUID() };
    void request(async () => {
      setState(await post<StudentState>(body));
    });
  }
  function back() {
    setRun(null);
    select(null);
    setTab("Map");
    void request(async () => {
      setState(await post<StudentState>({ action: "state", grade }));
    });
  }
  async function sign(e: FormEvent) {
    e.preventDefault();
    await request(async () => {
      await post({ action: "login", ...credentials, create });
      setCredentials({ ...credentials, pin: "" });
      const s = await post<StudentState>({ action: "state", grade });
      setState(s);
      setAuth(false);
      const requested = requestedGoal.current;
      requestedGoal.current = null;
      if (requested) openPreviewLevel(requested, s);
    });
  }
  if (practice) return <Practice level={practice} close={() => { setPractice(null); select(practice); }} />;
  if (run)
    return (
      <>
        <Battle
          key={run.run.id}
          initial={run}
          profile={state!.profile.id}
          sprite={state!.profile.sprite_name}
          username={state!.profile.username}
          onReturn={back}
          onRestart={(id) => enter(id, null)}
        />
        {message && (
          <aside role="alert" className="mt-toast">
            {message}
            {retry && <button onClick={() => pending.current && request(pending.current)}>Retry</button>}
          </aside>
        )}
      </>
    );
  const level = selected ? levelById.get(selected) : null,
    entry = selected ? byId.get(selected) : null;
  const notice = message && (
    <div role="alert" className="mt-alert">
      {message}
      {retry && (
        <button disabled={busy} onClick={() => pending.current && request(pending.current)}>
          Retry
        </button>
      )}
    </div>
  );
  return (
    <main className={"mt-shell mt-home" + (tab === "More Topics" ? " mp-home" : "")}>
      <header className="mt-top" hidden={tab === "More Topics"}>
        <Link href="/" aria-label="Game modes">
          ‹
        </Link>
        <strong>{grade}math</strong>
        <div />
        {state && <span className="mt-coins">{state.profile.coins.toLocaleString()} coins</span>}
        {accounts && <button
          className={state?.frame === "Gold" ? "mt-gold" : ""}
          onClick={() => (state ? setAccount(true) : setAuth(true))}
        >
          {state?.profile.username ?? "Sign in"}
        </button>}
      </header>
      {!auth && !selected && !account && notice}
      {tab === "Map" && <>
        <div className="mt-map-progress">
          <span>Main path</span>
          <span>{course && !main.total ? course.levels.length + " lessons" : main.cleared + " of " + main.total + " levels cleared"}</span>
          {accounts && (!course || main.total > 0) && <button onClick={() => openLeaderboard(main.next ?? main.target ?? (course?.levels[0].id ?? "review.add.1"))}>Leaderboards</button>}
        </div>
        {!course && main.total === 0 && <p className="mt-map-status">Lessons are awaiting publication.</p>}
        {main.target && !main.next && <p className="mt-map-status">Your next foundation is awaiting publication.</p>}
        {course ? <CourseMap lessons={course.skills} access={byId} next={main.next} open={select} /> : <CurriculumMap access={byId} main={main} open={id => { setMessage(""); select(id); }} />}
      </>}
      {tab === "More Topics" && course && <CourseFeed grade={grade === 6 ? 6 : 8} onTry={tryPreview} obscured={auth || account || !!selected || !!boardLevel} />}
      {tab === "More Topics" && !course && <PreviewFeed access={access} onTry={tryPreview} pinned={pinned}
        obscured={auth || account || !!selected || !!boardLevel} />}
      {tab !== "Map" && tab !== "More Topics" &&
        (state ? (
          tab === "Collection" ? (
            <Inventory state={state} act={act} busy={busy} initialSection={initialTab === "Collection" ? "Equipment" : undefined} />
          ) : (
            <Rewards state={state} act={act} busy={busy} />
          )
        ) : (
          <section className="mt-panel">
            <h1>{tab}</h1>
            <button onClick={() => setAuth(true)}>Sign in to see your {tab.toLowerCase()}</button>
          </section>
        ))}
      <nav className="mt-nav" aria-label={grade + "math menus"}>
        {(accounts ? ["Map", "More Topics", "Collection", "Rewards"] : ["Map", "More Topics"]).map((s, i) => (
          <button
            key={s}
            aria-current={tab === s ? "page" : undefined}
            onClick={() => {
              setMessage("");
              setTab(s);
            }}
          >
            <span aria-hidden="true">{["⌁", "▷", "▤", "✧"][i]}</span>
            {s}
          </button>
        ))}
      </nav>
      {boardLevel && state && !auth && <Leaderboard initialLevel={boardLevel} username={state.profile.username} close={() => setBoardLevel(null)} />}
      {level && entry && !auth && !boardLevel && (
        <Sheet close={() => !busy && select(null)}>
          <small>
            {course ? skillById.get(level.skill)!.world.slice(3) : skillById.get(level.skill)!.title + " · Level " + level.ordinal}
          </small>
          <h2>{level.title}</h2>
          <div className="mt-example">
            <small>Example question</small>
            <p>{level.preview.prompt}</p>
            <Visual data={level.preview.visual} />
          </div>
          <LessonVideo level={level.id} />
          {course && <Connections lessons={course.skills} level={level} access={byId} open={select} />}
          {(!course || entry.state !== "planned") && <p>Clear with 10 of 12 correct on the first try. For 3 stars, answer all 12 without a miss and meet the time target. Some lessons also require a first-try answer on a specific skill.</p>}
          {course && <button onClick={() => setPractice(level.id)}>{accounts && entry.state !== "planned" ? "Practice without saving" : "Practice lesson"}</button>}
          {accounts && (!course || entry.state !== "planned") && <button onClick={() => openLeaderboard(level.id)}>View leaderboard</button>}
          {state?.offer && level.id === checkpoint.review && (
            <p className="mt-bonus">
              Perfect review +25 coins. This offer is used when you start. Answer all 12 correctly on the
              first try to earn it.
            </p>
          )}
          {state?.offer && level.id === checkpoint.level && byId.get(checkpoint.review)?.state === "cleared" && (
            <button onClick={() => select(checkpoint.review)}>Visit 8 and 9 multiplication bonus</button>
          )}
          {notice}
          {playable(entry) && activeGrade !== grade ? (
            <Link href={`/${activeGrade}math`}>Return to your active {activeGrade}math battle</Link>
          ) : playable(entry) ? (
            <button className="mt-primary" disabled={busy || retry} onClick={() => enter(level.id)}>
              {busy ? "Starting…" : "Play"}
            </button>
          ) : (!course || entry.state !== "planned") && (
            <p>
              <strong>{entry.reason}</strong>
            </p>
          )}
        </Sheet>
      )}
      {auth && (
        <Sheet
          close={() => {
            if (!busy) {
              requestedGoal.current = null;
              setAuth(false);
              setBoardLevel(null);
              setMessage("");
            }
          }}
        >
          <h2>{create ? "Create a player" : "Player sign-in"}</h2>
          <form onSubmit={sign}>
            <PlayerFields value={credentials} onChange={setCredentials} create={create} />
            {notice}
            <button className="mt-primary" disabled={busy}>
              {create ? "Create player" : "Sign in"}
            </button>
          </form>
          <button
            onClick={() => {
              setCreate(!create);
              setMessage("");
            }}
          >
            {create ? "Use existing account" : "Create a player"}
          </button>
        </Sheet>
      )}
      {account && state && (
        <Sheet close={() => setAccount(false)}>
          <h2>{state.profile.username}</h2>
          <p>
            {state.title} {state.profile.xp} XP · {state.profile.coins} coins
          </p>
          {pinned && goal && <div>
            <p>Pinned topic · {skillById.get(pinned)!.title}{goal.complete ? " · Completed" : ""}</p>
            <button onClick={() => pinKey && saveGoal(pinKey, null)}>Unpin goal</button>
          </div>}
          {state.classes.length > 0 && (
            <label>
              Class
              <select value={state.classId ?? ""} onChange={(e) => act("class", e.target.value)}>
                {state.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {notice}
          <button
            onClick={() =>
              request(async () => {
                await post({ action: "logout" });
                setAccount(false);
                setPublicAccess(
                  accessMap(
                    new Set(state.access.filter((a) => a.state !== "planned").map((a) => a.id)),
                    [],
                    new Set(),
                    new Set(),
                    new Set(),
                    path,
                  ),
                );
                setState(null);
                setTab("Map");
              })
            }
          >
            Sign out
          </button>
        </Sheet>
      )}
    </main>
  );
}
