import { mainPathLevels, skillById, type Access, type MainPathProgress } from "../../../lib/mentalist/model";

const turns = [18, 27, 44, 53, 44, 27];
const x = (i: number) => turns[(i + turns.length) % turns.length];
const y = (i: number) => i * 100 + 50;
// Interpolate between marker centers with matching tangents, including at topic boundaries.
const path = mainPathLevels.reduce((line, _, i) => {
  if (i === 0) return `M ${x(0)} ${y(0)}`;
  const a = i - 1;
  return line + ` C ${x(a) + (x(i) - x(a - 1)) / 6} ${y(a) + 100 / 3}
    ${x(i) - (x(i + 1) - x(a)) / 6} ${y(i) - 100 / 3} ${x(i)} ${y(i)}`;
}, "");

const topicHues: Record<string, number> = {
  "review.add": 137, "review.subtract": 202, "review.multiply": 50, "review.divide": 252,
  "review.factors": 170, "review.fractions": 26, "review.numberline": 204, "review.coordinate": 161,
  "review.whole": 47, "review.conversions": 264, "review.expressions": 157, "review.onestep": 211,
  "review.data": 179, "review.area": 45, "review.angles": 260,
  number: 204, ratio: 151, percent: 39, similar: 165, chance: 267, stats: 184,
  linear: 224, algebra: 259, geometry: 37, circle: 193, area: 80, solid: 161, finance: 26,
};

export function CurriculumMap({access, main, open}: {
  access: Map<string, Access>;
  main: MainPathProgress;
  open: (level: string) => void;
}) {
  const frontier = main.target ? mainPathLevels.findIndex(level => level.id === main.target) : mainPathLevels.length;
  return <div className="mt-trail" aria-label="Curriculum map" role="region" tabIndex={0}>
    <div className="mt-route">
      <svg className="mt-route-line" viewBox={`0 0 100 ${mainPathLevels.length * 100}`}
        preserveAspectRatio="none" aria-hidden="true">
        <path d={path} />
      </svg>
      <ol aria-label="Curriculum levels">
        {mainPathLevels.map((level, index) => {
          const skill = skillById.get(level.skill)!;
          const entry = access.get(level.id)!;
          const current = level.id === main.next;
          const cleared = entry.state === "cleared";
          const replay = cleared && index < frontier;
          const hue = topicHues[skill.world === "review" ? skill.group : skill.world];
          const name = [skill.title, level.title, current ? "Current level" : cleared ? "Completed" : "Upcoming"].join(", ");
          const content = <>
            <span className="mt-route-number">{index + 1}</span>
            <span className="mt-route-label">
              {skill.title !== level.title && <small>{skill.title}</small>}
              <strong>{level.title}</strong>
              {current && <span>Continue</span>}
              {cleared && <span>Completed{entry.stars ? " · " + "★".repeat(entry.stars) : ""}</span>}
            </span>
          </>;
          return <li id={"stop-" + level.id} key={level.id} data-topic={skill.group}
            style={{"--spot": x(index) + "%", "--hue": hue} as React.CSSProperties}>
            <div className="mt-route-row">
              {current || replay ?
                <button type="button" className={"mt-route-entry " + (current ? "is-current" : "is-complete")}
                  aria-label={name} aria-current={current ? "step" : undefined} onClick={() => open(level.id)}>
                  {content}
                </button> :
                <div className="mt-route-entry is-upcoming">{content}</div>}
            </div>
          </li>;
        })}
      </ol>
    </div>
  </div>;
}
