"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  accessMap,
  checkpoint,
  levelById,
  mainPathProgress,
  playable,
  skillById,
  sprites,
  type RunView,
  type StudentState,
} from "../../lib/mentalist/model";
import { post, RequestError } from "../../lib/mentalist/client";
import { LessonVideo, PreviewFeed } from "./components/PreviewFeed";
import { previewGoal } from "../../lib/mentalist/preview-goals";
import previews from "../../content/mentalist/previews.json";
import { CurriculumMap } from "./components/CurriculumMap";
import { Battle } from "./components/Battle";
import { Inventory, Rewards } from "./components/Inventory";
import { Visual } from "./components/Visual";
import "./trail.css";

function Sheet({ children, close }: { children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => {
      d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="mt-sheet"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current!.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
        }
      }}
    >
      <button className="mt-close" onClick={close} aria-label="Close">
        ×
      </button>
      {children}
    </dialog>
  );
}
export default function Trail({
  initialStudent,
  published,
  initialTab = "Map",
}: {
  initialStudent: StudentState | null;
  published: string[];
  initialTab?: "Map" | "More Topics";
}) {
  const [state, setState] = useState<StudentState | null>(initialStudent),
    [run, setRun] = useState<RunView | null>(null),
    [tab, setTab] = useState<string>(initialTab),
    [selected, select] = useState<string | null>(null);
  const [auth, setAuth] = useState(false),
    [create, setCreate] = useState(false),
    [name, setName] = useState(""),
    [pin, setPin] = useState(""),
    [sprite, setSprite] = useState(sprites[0]),
    [account, setAccount] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [retry, setRetry] = useState(false);
  const pending = useRef<null | (() => Promise<void>)>(null),
    lock = useRef(false);
  const [publicAccess, setPublicAccess] = useState(() =>
    accessMap(new Set(published), [], new Set(), new Set(), new Set()),
  );
  const access = state?.access ?? publicAccess,
    byId = new Map(access.map((a) => [a.id, a])),
    main = mainPathProgress(access);
  const requestedGoal = useRef<string | null>(null);
  const pinKey = state ? "mentalist:preview-goal:" + state.profile.id : null;
  const [savedPin, setSavedPin] = useState<{ key: string; skill: string } | null>(null);
  const pinned = savedPin?.key === pinKey ? savedPin?.skill : null;
  const goal = pinned ? previewGoal(pinned, access) : null;
  useEffect(() => {
    if (!pinKey) return;
    try {
      const stored = localStorage.getItem(pinKey);
      setSavedPin(stored && previews.some(clip => clip.skill === stored) ? {key: pinKey, skill: stored} : null);
    } catch { /* The current visit can use the in-memory pin. */ }
  }, [pinKey]);
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
    select(target.next);
  }
  function tryPreview(skill: string) {
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
    const body = { action: "start", id: crypto.randomUUID(), level: id, previous };
    void request(async () => {
      const r = await post<RunView>(body);
      setRun(r);
      select(null);
    });
  }
  function act(action: string, value: string) {
    const body = { action, value, id: crypto.randomUUID() };
    void request(async () => {
      setState(await post<StudentState>(body));
    });
  }
  function back() {
    setRun(null);
    select(null);
    setTab("Map");
    void request(async () => {
      setState(await post<StudentState>({ action: "state" }));
    });
  }
  async function sign(e: FormEvent) {
    e.preventDefault();
    await request(async () => {
      const p = await post<{ id: string }>({ action: "login", username: name, pin, sprite, create });
      sessionStorage.setItem("activeProfileId", p.id);
      setPin("");
      const s = await post<StudentState>({ action: "state" });
      setState(s);
      setAuth(false);
      const requested = requestedGoal.current;
      requestedGoal.current = null;
      if (requested) openPreviewLevel(requested, s);
    });
  }
  if (run)
    return (
      <>
        <Battle
          key={run.id}
          initial={run}
          sprite={state!.profile.sprite_name}
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
        <strong>Mentalist</strong>
        <div />
        {state && <span className="mt-coins">{state.profile.coins.toLocaleString()} coins</span>}
        <button
          className={state?.frame === "Gold" ? "mt-gold" : ""}
          onClick={() => (state ? setAccount(true) : setAuth(true))}
        >
          {state?.profile.username ?? "Sign in"}
        </button>
      </header>
      {!auth && !selected && !account && notice}
      {tab === "Map" && <>
        <div className="mt-map-progress">
          <span>Main path</span>
          <span>{main.cleared} of {main.total} levels cleared</span>
        </div>
        {main.total === 0 && <p className="mt-map-status">Lessons are awaiting publication.</p>}
        {main.target && !main.next && <p className="mt-map-status">Your next foundation is awaiting publication.</p>}
        <CurriculumMap access={byId} main={main} open={id => { setMessage(""); select(id); }} />
      </>}
      {tab === "More Topics" && <PreviewFeed access={access} onTry={tryPreview} pinned={pinned}
        obscured={auth || account || !!selected} />}
      {tab !== "Map" && tab !== "More Topics" &&
        (state ? (
          tab === "Collection" ? (
            <Inventory state={state} act={act} busy={busy} />
          ) : (
            <Rewards state={state} act={act} busy={busy} />
          )
        ) : (
          <section className="mt-panel">
            <h1>{tab}</h1>
            <button onClick={() => setAuth(true)}>Sign in to see your {tab.toLowerCase()}</button>
          </section>
        ))}
      <nav className="mt-nav" aria-label="Mentalist menus">
        {["Map", "More Topics", "Collection", "Rewards"].map((s, i) => (
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
      {level && entry && !auth && (
        <Sheet close={() => !busy && select(null)}>
          <small>
            {skillById.get(level.skill)!.title} · Level {level.ordinal}
          </small>
          <h2>{level.title}</h2>
          <div className="mt-example">
            <small>Example question</small>
            <p>{level.preview.prompt}</p>
            <Visual data={level.preview.visual} />
          </div>
          <LessonVideo level={level.id} />
          <p>12 questions · Clear with 10 first-try correct.</p>
          {state?.offer && level.id === checkpoint.review && (
            <p className="mt-bonus">
              Perfect review +25 coins. This offer is used when you start. Answer all 12 correctly on the
              first try to earn it.
            </p>
          )}
          {state?.offer && level.id === checkpoint.level && byId.get(checkpoint.review)?.state === "cleared" && (
            <button onClick={() => select(checkpoint.review)}>Visit 9× bonus</button>
          )}
          {notice}
          {playable(entry) ? (
            <button className="mt-primary" disabled={busy || retry} onClick={() => enter(level.id)}>
              {busy ? "Starting…" : "Play"}
            </button>
          ) : (
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
              setMessage("");
            }
          }}
        >
          <h2>{create ? "Create a player" : "Player sign-in"}</h2>
          <form onSubmit={sign}>
            <label>
              Username
              <input
                autoComplete="username"
                required
                pattern="[a-zA-Z0-9_]{3,16}"
                maxLength={16}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Two-digit PIN
              <input
                type="password"
                inputMode="numeric"
                required
                pattern="[0-9]{2}"
                maxLength={2}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </label>
            {create && (
              <label>
                Character
                <select value={sprite} onChange={(e) => setSprite(e.target.value)}>
                  {sprites.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
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
                sessionStorage.removeItem("activeProfileId");
                setAccount(false);
                setPublicAccess(
                  accessMap(
                    new Set(state.access.filter((a) => a.state !== "planned").map((a) => a.id)),
                    [],
                    new Set(),
                    new Set(),
                    new Set(),
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
