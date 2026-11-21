import { useEffect, useState } from "react";
import { skills, sprites, type StudentState } from "../../../lib/mentalist/model";
export function Inventory({
  state,
  act,
  busy,
}: {
  state: StudentState;
  act: (a: string, v: string) => void;
  busy: boolean;
}) {
  const [section, setSection] = useState("Skills");
  return (
    <section className="mt-panel">
      <h1>Collection</h1>
      <div className="mt-switch">
        {["Skills", "Characters", "Legacy"].map((s) => (
          <button aria-pressed={section === s} key={s} onClick={() => setSection(s)}>
            {s}
          </button>
        ))}
      </div>
      {section === "Skills" &&
        (state.cards.length ? (
          state.cards.map((c) => (
            <article className="mt-row" key={c.skill}>
              <div>
                <h3>{skills.find((s) => s.id === c.skill)?.title}</h3>
                <p>
                  Level {c.upgrade} · {c.amount} card{c.amount === 1 ? "" : "s"}
                </p>
              </div>
              {c.upgrade < 4 && (
                <button
                  disabled={busy || c.amount < 40 || state.profile.coins < 2000}
                  onClick={() => act("upgrade", c.skill)}
                >
                  Upgrade · 40 cards + 2,000 coins
                </button>
              )}
            </article>
          ))
        ) : (
          <p>Answer a question correctly to earn your first skill card.</p>
        ))}
      {section === "Characters" && (
        <>
          <div className="mt-sprites">
            {sprites.map((s, i) => (
              <button
                key={s}
                aria-pressed={state.profile.sprite_name === s}
                disabled={busy || (!state.ownedSprites.includes(s) && i >= 1 + state.clearedSkills * 3)}
                onClick={() => act("appearance", s)}
              >
                <img src={`/sprites/${s}.png`} alt="" />
                {s}
              </button>
            ))}
          </div>
          <h2>Profile cosmetics</h2>
          {[
            ["Trail Scholar", 1],
            ["Gold", 3],
          ].map(([s, num]) => (
            <article className="mt-row" key={s}>
              <div>
                <h3>{s === "Gold" ? "Gold frame" : "Trail Scholar title"}</h3>
                <p>
                  Clear {num} skill{num === 1 ? "" : "s"}
                </p>
              </div>
              <button
                disabled={busy || state.clearedSkills < Number(num)}
                onClick={() => act("appearance", String(s))}
              >
                {state.title === s || state.frame === s ? "Equipped" : "Equip"}
              </button>
            </article>
          ))}
        </>
      )}
      {section === "Legacy" &&
        state.legacySkills.map((c) => (
          <p className="mt-row" key={c.skill_id}>
            {c.skill_id} · Level {c.level} · {c.card_count} cards
          </p>
        ))}
      {section === "Legacy" &&
        (state.legacy.length
          ? state.legacy.map((c) => (
              <p className="mt-row" key={c.number}>
                Number {c.number} · Level {c.level} · {c.card_count} cards
              </p>
            ))
          : !state.legacySkills.length && <p>No legacy number cards.</p>)}
    </section>
  );
}
export function Rewards({
  state,
  act,
  busy,
}: {
  state: StudentState;
  act: (a: string, v: string) => void;
  busy: boolean;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const unlocking = state.chests.some((c) => c.ready && +new Date(c.ready) > now);
  return (
    <section className="mt-panel">
      <h1>Rewards</h1>
      <h2>Chest slots</h2>
      <div className="mt-chests">
        {Array.from({ length: 4 }, (_, i) => {
          const c = state.chests.find((c) => c.slot === i),
            seconds = c?.ready ? Math.max(0, Math.ceil((+new Date(c.ready) - now) / 1000)) : null;
          return (
            <article key={i}>
              <small>Slot {i + 1}</small>
              <h3>
                {!c
                  ? "Empty"
                  : seconds === 0
                    ? "Ready to open"
                    : seconds === null
                      ? "Sealed chest"
                      : Math.ceil(seconds / 60) + " min left"}
              </h3>
              {c && (
                <>
                  {seconds === 0 ? (
                    <button disabled={busy} onClick={() => act("open", c.id)}>
                      Open chest
                    </button>
                  ) : (
                    <>
                      {!c.ready && (
                        <button
                          disabled={busy || (unlocking && state.profile.coins < 1000)}
                          onClick={() => act(unlocking ? "queue" : "unlock", c.id)}
                        >
                          {unlocking ? "Queue · 1,000 coins" : "Unlock · 2 hours"}
                        </button>
                      )}
                      <button
                        disabled={busy || state.profile.coins < 6000}
                        onClick={() => act("instant", c.id)}
                      >
                        Open · 6,000 coins
                      </button>
                    </>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
      <h2>Daily quests</h2>
      {state.quests.map((q) => (
        <article className="mt-row" key={q.id}>
          <div>
            <h3>{q.name}</h3>
            <p>
              {Math.min(q.count, q.goal)} / {q.goal} · {q.coins} coins
            </p>
          </div>
          <button disabled={busy || q.claimed || q.count < q.goal} onClick={() => act("quest", q.id)}>
            {q.claimed ? "Claimed" : "Claim"}
          </button>
        </article>
      ))}
    </section>
  );
}
