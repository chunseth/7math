"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clips from "../../../content/mentalist/previews.json";
import { skillById, type Access } from "../../../lib/mentalist/model";
import { previewGoal } from "../../../lib/mentalist/preview-goals";
import "./previews.css";

type Clip = (typeof clips)[number];
type Props = {
  access?: Access[];
  pinned?: string | null;
  onPin?: (skill: string | null) => void;
  obscured?: boolean;
};

function Example({ clip, active, obscured }: { clip: Clip; active: boolean; obscured: boolean }) {
  const player = useRef<HTMLVideoElement>(null);
  const base = "/mentalist/previews/" + clip.skill;
  useEffect(() => {
    if (!active || !player.current) return;
    const video = player.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function pauseIfHidden() {
      if (document.hidden) video.pause();
    }
    function motionChanged() {
      if (motion.matches) video.pause();
    }
    if (!obscured && !document.hidden && !motion.matches) void video.play().catch(() => {});
    document.addEventListener("visibilitychange", pauseIfHidden);
    motion.addEventListener("change", motionChanged);
    return () => {
      video.pause();
      document.removeEventListener("visibilitychange", pauseIfHidden);
      motion.removeEventListener("change", motionChanged);
    };
  }, [active, obscured]);
  return <video ref={player} muted playsInline controls={active} preload={active ? "metadata" : "none"}
    aria-label={clip.topic + " worked example"} poster={base + ".webp"}
    src={active ? base + ".mp4" : undefined} />;
}

export function PreviewFeed({access, pinned, onPin, obscured = false}: Props) {
  const [quickOnly, setQuickOnly] = useState(false);
  const [index, setIndex] = useState(0);
  const [transcript, setTranscript] = useState<Clip | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const goals = useMemo(() => new Map(clips.map(clip =>
    [clip.skill, access && previewGoal(clip.skill, access)])), [access]);
  const visible = clips.filter(clip => !quickOnly || goals.get(clip.skill)?.quick);
  const current = Math.min(index, Math.max(0, visible.length - 1));

  function go(i: number) {
    const card = scroller.current?.children.item(i) as HTMLElement | null;
    if (card) scroller.current!.scrollTo({ top: card.offsetTop, behavior: "instant" });
  }
  useEffect(() => {
    if (!transcript) return;
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, [transcript]);
  return <section className="mp-feed" aria-label="Skill previews">
    <header className="mp-bar">
      <h1>Skill previews</h1>
      {access && <div className="mp-filters" aria-label="Preview filter">
        {[false,true].map(quick => <button key={String(quick)} aria-pressed={quickOnly === quick}
          onClick={() => { go(0); setIndex(0); setQuickOnly(quick); }}>
          {quick ? "Quick quests" : "All six"}
        </button>)}
      </div>}
    </header>
    {visible.length ? <>
      <div className="mp-scroll" ref={scroller} tabIndex={0} aria-label="Swipe up for the next skill"
        onScroll={e => { const el = e.currentTarget; setIndex(Math.round(el.scrollTop / Math.max(1, el.clientHeight))); }}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); go(current + (e.key === "ArrowDown" ? 1 : -1));
          }
        }}>
        {visible.map((clip, i) => {
          const goal = goals.get(clip.skill);
          return <article key={clip.skill} className="mp-card" aria-label={clip.topic} inert={i !== current}>
            <div className="mp-paper">
              <Example clip={clip} active={i === current} obscured={obscured || !!transcript}/>
            </div>
            <div className="mp-caption">
              <div>
                <h2>{clip.topic}</h2>
                {goal && <small>{goal.complete ? "Skill cleared" : !goal.available ? "Preview only" :
                  (goal.foundations.length === 0 ? "Ready now" : goal.foundations.length === 1 ?
                    "Needs " + skillById.get(goal.foundations[0])!.title : goal.foundations.length + " foundations needed")
                  + " · " + goal.remaining + (goal.remaining === 1 ? " level left" : " levels left")}</small>}
              </div>
              <button onClick={() => setTranscript(clip)}>Read steps</button>
              {onPin && (goal?.quick || pinned === clip.skill) && <button className="mp-pin"
                aria-pressed={pinned === clip.skill} onClick={() => onPin(pinned === clip.skill ? null : clip.skill)}>
                {pinned === clip.skill ? "Unpin" : "Pin goal"}
              </button>}
            </div>
          </article>;
        })}
      </div>
      <footer className="mp-pager">
        <button aria-label="Previous preview" disabled={current === 0} onClick={() => go(current-1)}>↑</button>
        <span aria-live="polite">{current+1} of {visible.length}</span>
        <button aria-label="Next preview" disabled={current === visible.length-1} onClick={() => go(current+1)}>↓</button>
      </footer>
    </> : <p className="mp-empty">No quick quests are available among these six skills. Choose All six to watch the examples.</p>}
    {transcript && <dialog ref={dialog} className="mt-sheet" aria-labelledby="mp-transcript"
      onCancel={e => { e.preventDefault(); setTranscript(null); }}>
      <button className="mt-close" aria-label="Close steps" onClick={() => setTranscript(null)}>×</button>
      <h2 id="mp-transcript">{transcript.topic}</h2>
      <p>{transcript.prompt} {transcript.subprompt}</p>
      <ol>{transcript.steps.map(step => <li key={step.label}>{step.label} <strong>{step.math}</strong></li>)}</ol>
      <p>Answer <strong>{transcript.answer}</strong></p>
    </dialog>}
  </section>;
}
