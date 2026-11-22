"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import clips from "../../../content/mentalist/previews.json";
import { skillById, type Access } from "../../../lib/mentalist/model";
import { previewGoal, sideGoals } from "../../../lib/mentalist/preview-goals";
import "./previews.css";

type Clip = (typeof clips)[number];
type Item = { clip: Clip; goal: ReturnType<typeof previewGoal> };

function Playback({ clip, active, obscured }: { clip: Clip; active: boolean; obscured: boolean }) {
  const player = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const base = "/mentalist/previews/" + (clip.media ?? (clip.model === "worked" ? clip.level : clip.skill));
  useEffect(() => {
    if (!active || obscured) return;
    const video = player.current!;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let resume = !motion.matches;
    function play() {
      if (!document.hidden && resume) void video.play().catch(() => setPaused(true));
    }
    function visibility() {
      if (document.hidden) {
        resume = !video.paused;
        video.pause();
      } else play();
    }
    function motionChanged() {
      if (motion.matches) video.pause();
    }
    setPaused(video.paused);
    play();
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", motionChanged);
    return () => {
      video.pause();
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", motionChanged);
    };
  }, [active, obscured]);

  const title = skillById.get(clip.skill)!.title;
  return <>
    <video ref={player} muted playsInline loop disablePictureInPicture disableRemotePlayback
      controls={false} controlsList="nofullscreen nodownload noremoteplayback"
      preload={active ? "auto" : "none"} poster={base + ".webp"}
      src={active ? base + ".mp4" : undefined} aria-hidden="true"
      onPlay={() => setPaused(false)} onPause={() => setPaused(true)} />
    <button type="button" className="mp-tap" aria-label={(paused ? "Play " : "Pause ") + title}
      onClick={() => {
        const video = player.current!;
        if (video.paused) void video.play().catch(() => setPaused(true));
        else video.pause();
      }}>
      {active && paused && <span aria-hidden="true" className="mp-play">▶</span>}
    </button>
    <span className="mp-sr">{clip.prompt} {clip.subprompt} {clip.steps.map(step =>
      step.label + " " + step.math + ".").join(" ")} Answer {clip.answer}.</span>
  </>;
}

type ReelProps = {
  items: Item[];
  obscured: boolean;
  onTry?: (skill: string) => void;
};

function Reel({ items, obscured, onTry }: ReelProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const wrap = items.length > 1;
  const first = wrap ? 1 : 0;
  const [position, setPosition] = useState(first);
  // The two end cards let native scroll snap carry a swipe across either boundary.
  const cards = wrap ? [items[items.length - 1], ...items, items[0]] : items;
  useLayoutEffect(() => {
    const el = scroller.current!;
    el.scrollTop = first * el.clientHeight;
  }, [first]);
  return <div className="mp-scroll" ref={scroller} tabIndex={0} aria-label="Skill videos"
    onScroll={({currentTarget: el}) => {
      const height = el.clientHeight;
      if (!height) return;
      let page = Math.max(0, Math.min(cards.length - 1, Math.round(el.scrollTop / height)));
      if (wrap && (el.scrollTop <= 1 || el.scrollTop >= el.scrollHeight - height - 1)) {
        page = page === 0 ? items.length : first;
        el.scrollTop = page * height;
      }
      setPosition(page);
    }}
    onKeyDown={e => {
      if (!wrap || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      const el = e.currentTarget;
      el.focus({preventScroll: true});
      el.scrollBy({top: (e.key === "ArrowDown" ? 1 : -1) * el.clientHeight, behavior: "instant"});
    }}>
    {cards.map(({clip, goal}, i) => {
      const title = skillById.get(clip.skill)!.title;
      return <article key={i + clip.skill} className="mp-card" aria-label={title} inert={i !== position}>
        {Math.abs(i - position) <= 1 && <Playback clip={clip} active={i === position} obscured={obscured} />}
        <div className="mp-caption">
          <div><h2>{title}</h2><p>{goal.remaining} {goal.remaining === 1 ? "level" : "levels"} to complete
            {goal.foundations.length > 0 && <> · First, {skillById.get(goal.foundations[0])!.title}</>}
          </p></div>
          <button type="button" className="mp-try" disabled={!onTry || !goal.available}
            onClick={() => onTry?.(clip.skill)}>Try it</button>
        </div>
      </article>;
    })}
  </div>;
}

const clipByLevel = new Map(clips.map(clip => [clip.level, clip]));

export function LessonVideo({level}: {level: string}) {
  const [open, setOpen] = useState(false);
  const clip = clipByLevel.get(level);
  if (!clip) return null;
  return <>
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? "Close example" : "Watch worked example"}
    </button>
    {open && <div className="mp-lesson-player mp-card"><Playback clip={clip} active obscured={false} /></div>}
  </>;
}

const filters = ["All", "Ready now", "1 prerequisite"] as const;

export function PreviewFeed({ access, obscured, onTry, pinned }: {
  access: Access[]; obscured: boolean; onTry?: (skill: string) => void; pinned?: string | null;
}) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const eligible = useMemo(() => {
    const items = sideGoals(access).map(({level, goal}) => ({clip: clipByLevel.get(level.id)!, goal}));
    return [...items.filter(item => item.clip.skill === pinned), ...items.filter(item => item.clip.skill !== pinned)];
  }, [access, pinned]);
  const items = eligible.filter(({goal}) => filter === "All" ||
    goal.foundations.length === (filter === "Ready now" ? 0 : 1));
  return <section className="mp-feed" aria-label="More Topics">
    <div className="mp-filters" role="group" aria-label="Preview filter">
      {filters.map(value => <button type="button" key={value} aria-pressed={filter === value}
        onClick={() => setFilter(value)}>{value}</button>)}
    </div>
    {items.length ? <Reel key={items.map(item => item.clip.level).join("|")} items={items}
      onTry={onTry} obscured={obscured} /> :
      <p className="mp-empty">{!onTry ? "Lesson availability is unavailable. Return to the map to reconnect." :
        eligible.length ? "No skills match this filter. Choose All to see your other skills." :
        "No unfinished side goals are available. Visit the map to continue or replay a lesson."}</p>}
  </section>;
}
