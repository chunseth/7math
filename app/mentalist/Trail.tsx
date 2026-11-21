"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  accessMap,
  checkpoint,
  levelById,
  levels,
  playable,
  skillById,
  sprites,
  worlds,
  worldTitles,
  type RunView,
  type StudentState,
} from "../../lib/mentalist/model";
import { post, RequestError } from "../../lib/mentalist/client";
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
}: {
  initialStudent: StudentState | null;
  published: string[];
}) {
  const [state, setState] = useState<StudentState | null>(initialStudent),
    [run, setRun] = useState<RunView | null>(null),
    [tab, setTab] = useState("Map"),
    [selected, select] = useState<string | null>(null);
  const [auth, setAuth] = useState(false),
    [create, setCreate] = useState(false),
    [name, setName] = useState(""),
    [pin, setPin] = useState(""),
    [sprite, setSprite] = useState(sprites[0]),
    [account, setAccount] = useState(false);
  const [world, setWorld] = useState("number"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [retry, setRetry] = useState(false);
  const pending = useRef<null | (() => Promise<void>)>(null),
    lock = useRef(false),
    map = useRef<HTMLDivElement>(null),
    anchor = useRef<string | null>(null);
  const [publicAccess, setPublicAccess] = useState(() =>
    accessMap(new Set(published), [], new Set(), new Set(), new Set()),
  );
  const access = state?.access ?? publicAccess,
    byId = new Map(access.map((a) => [a.id, a])),
    rec =
      state?.recommendation?.level ??
      (publicAccess.some((a) => a.id === "signed.add.1" && playable(a))
        ? "signed.add.1"
        : publicAccess.find(playable)?.id);
  const show = (id: string, behavior: ScrollBehavior = "auto") => {
    const l = levelById.get(id);
    if (l) setWorld(skillById.get(l.skill)!.world);
    document.getElementById("stop-" + id)?.scrollIntoView({ block: "center", behavior });
  };
  const initialFocus = useRef(rec);
  useEffect(() => {
    if (initialFocus.current) show(initialFocus.current);
  }, []);
  useEffect(() => {
    if (!run && tab === "Map" && anchor.current) show(anchor.current);
  }, [run]);
  useEffect(() => {
    if (!map.current || run || tab !== "Map") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setWorld((e.target as HTMLElement).dataset.world!);
      },
      { root: map.current, rootMargin: "0px 0px -75% 0px" },
    );
    map.current.querySelectorAll("[data-world]").forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, [tab, run]);
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
  function back(id: string) {
    anchor.current = id;
    setRun(null);
    select(null);
    setTab("Map");
    void request(async () => {
      setState(await post<StudentState>({ action: "state" }));
      show(id);
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
      if (!selected && s.recommendation) show(s.recommendation.level);
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
    <main className="mt-shell mt-home">
      <header className="mt-top">
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
      <div className="mt-map-head" hidden={tab !== "Map"}>
        <div>
          <small>World {String(worlds.indexOf(world) + 1).padStart(2, "0")}</small>
          <h1>{worldTitles[world]}</h1>
        </div>
        <label>
          Jump to world
          <select
            aria-label="Jump to world"
            value={world}
            onChange={(e) => {
              const id = e.target.value;
              const l = levels.find((l) => skillById.get(l.skill)!.world === id)!;
              show(l.id);
            }}
          >
            {worlds.map((w) => (
              <option key={w} value={w}>
                {worldTitles[w]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div ref={map} className="mt-trail" hidden={tab !== "Map"} aria-label="Level trail">
        {worlds.map((w, wi) => (
          <section data-world={w} key={w} className={"mt-world tone-" + (wi % 4)}>
            <h2>
              {worldTitles[w]}
              {w === "review" && <small>Optional</small>}
            </h2>
            {levels
              .filter((l) => skillById.get(l.skill)!.world === w)
              .map((l, i) => {
                const a = byId.get(l.id)!,
                  skill = skillById.get(l.skill)!,
                  spot = [0, 1, 2, 1][i % 4],
                  next = [0, 1, 2, 1][(i + 1) % 4],
                  px = [15, 36, 57];
                return (
                  <div
                    className="mt-stop"
                    onClick={(e) => {
                      if (!(e.target as Element).closest("button")) {
                        setMessage("");
                        select(l.id);
                      }
                    }}
                    key={l.id}
                    id={"stop-" + l.id}
                    style={{ "--spot": px[spot] + "%" } as React.CSSProperties}
                  >
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <path d={`M${px[spot]} 0 C${px[spot]} 54 ${px[next]} 46 ${px[next]} 100`} />
                    </svg>
                    <button
                      className={`mt-node state-${a.state} ${rec === l.id ? "recommended" : ""}`}
                      onClick={() => {
                        setMessage("");
                        select(l.id);
                      }}
                      aria-label={`${skill.title}, ${l.title}, ${a.reason}`}
                    >
                      <strong>{l.ordinal}</strong>
                      <span>
                        {a.stars
                          ? "★".repeat(a.stars)
                          : a.state === "locked"
                            ? "◇"
                            : a.state === "placed"
                              ? "P"
                              : "·"}
                      </span>
                    </button>
                    <div className="mt-label">
                      <small>{skill.title}</small>
                      <b>{l.title}</b>
                      <em>
                        {state?.offer && l.id === checkpoint.review
                          ? "Perfect review +25"
                          : rec === l.id
                            ? (state?.recommendation?.reason ?? "Recommended")
                            : a.state === "locked"
                              ? "Locked"
                              : a.reason}
                      </em>
                      {state?.offer && l.id === checkpoint.level && (
                        <button
                          onClick={() => {
                            show(checkpoint.review);
                            select(checkpoint.review);
                          }}
                        >
                          Visit 9× bonus →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </section>
        ))}
      </div>
      {tab !== "Map" &&
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
        {["Map", "Collection", "Rewards"].map((s, i) => (
          <button
            key={s}
            aria-current={tab === s ? "page" : undefined}
            onClick={() => {
              setMessage("");
              setTab(s);
            }}
          >
            <span aria-hidden="true">{["⌁", "▤", "✧"][i]}</span>
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
          <p>12 questions · Clear with 10 first-try correct.</p>
          {state?.offer && level.id === checkpoint.review && (
            <p className="mt-bonus">
              Perfect review +25 coins. This offer is used when you start. Answer all 12 correctly on the
              first try to earn it.
            </p>
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
