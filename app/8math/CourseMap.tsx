import { SampleExperiment } from "./Models";
import { courses, gradeOf, type Access, type Level } from "../../lib/mentalist/model";

type Lessons = (typeof courses)[6]["skills"];

export function CourseMap({ lessons, access, next, open }: { lessons: Lessons; access: Map<string, Access>; next: string | null; open: (id: string) => void }) {
  function row(s: Lessons[number], index: number) {
    const id = s.id + "." + (index+1), entry = access.get(id);
    const status = entry?.state === "cleared" ? "★".repeat(entry.stars) :
      next === id ? "Continue" : s.stages ? `Level ${index+1} of ${s.levels.length}` : s.standards.join(" · ");
    return <li id={"stop-" + id} key={id}><button aria-current={next === id ? "step" : undefined} onClick={() => open(id)}>
      <span>{s.previousPrerequisites ? "Mixed practice · " : ""}{s.levels[index]}</span><small>{status}</small>
    </button></li>;
  }
  return <div role="region" aria-label="Curriculum map" className="mt-trail g8-map">
    {Array.from(new Set(lessons.map(s => s.unit))).map(unit =>
      <section key={unit}><h2>{unit}</h2>
        {lessons.filter(s => s.unit === unit).map(s => <div key={s.id}>
          {s.stages && <h3>{s.title}</h3>}
          <ol>{s.levels.map((_, index) => row(s, index))}</ol>
        </div>)}
      </section>)}
  </div>;
}

const transfer: Record<string,string> = {
  "scientific-ops": "Comparing scientific measurements and orders of magnitude",
  compose: "Coordinate proofs with composite transformations",
  "compare-functions": "Analyzing piecewise functions in Algebra I",
  "system-algebra": "Modeling and solving simultaneous constraints",
  "two-way": "Conditional probability and categorical association",
  scientific: "Scientific measurement and calculations with powers of ten",
  order: "Comparing measured and estimated quantities",
  "scale-area": "Area and volume under similarity",
  inequality: "Algebra I constraints and feasible solutions",
  systems: "Comparing break-even points in Algebra I",
  distance: "Coordinate proofs and the distance formula",
  cone: "Composite solids and capacity",
  sphere: "Surface-to-volume comparisons",
  "cylinder-surface": "Material estimates and composite solids",
  trend: "Regression and interpreting residuals",
  sampling: "Statistical inference from samples",
  college: "Budgeting and long-term financial planning",
};
const sixthTransfer: Record<string, string> = {
  fluency: "Grade 7 multi-step rational-number calculations",
  polygons: "Grade 7 scale drawings and composite figures",
  nets: "Grade 7 lateral and total surface area",
  deviation: "Grade 7 comparisons of variability in samples",
  convert: "Grade 7 unit rates and proportional scale drawings",
  inequalities: "Grade 7 multi-step equations and inequalities",
  triangles: "Grade 7 angle relationships and similar figures",
  trapezoids: "Grade 7 composite figures and area",
  prisms: "Grade 7 volume and surface area",
  histograms: "Grade 7 comparisons of distributions",
  spread: "Grade 7 comparisons of samples and populations",
  categories: "Grade 7 probability and experimental frequencies",
  income: "Grade 7 household budgets and financial planning",
};
export function Connections({ lessons, level, access, open }: { lessons: Lessons; level: Level; access: Map<string, Access>; open: (level: string) => void }) {
  const lesson = lessons.find(s => s.id === level.skill)!;
  const prefix = "g" + gradeOf(level.id);
  const legacy = access.get(prefix + ".sets.1")?.state !== "planned" && access.get(prefix + ".steps-sets.1")?.state === "planned";
  const parents = (s: typeof lesson) => legacy ? s.previousPrerequisites ?? s.prerequisites : s.prerequisites;
  const children = lessons.filter(s => parents(s).includes(lesson.id));
  function link(skill: typeof lesson, ordinal: number) {
    const id = skill.id + "." + ordinal;
    return <button key={id} onClick={() => open(id)}>{skill.levels[ordinal-1]}</button>;
  }
  const predecessor = level.ordinal > 1 ? link(lesson, level.ordinal-1) : null;
  const successor = level.ordinal < lesson.levels.length ? link(lesson, level.ordinal+1) : null;
  return <div className="g8-connections">
    {lesson.id === "g8.sampling" && <SampleExperiment />}
    <h3>Prerequisites</h3>{predecessor ?? (parents(lesson).length ? parents(lesson).map(p => {
      const parent = lessons.find(s => s.id === p)!;
      const first = parent.levels.findIndex((_, i) => !["cleared","placed"].includes(access.get(parent.id+"."+(i+1))?.state ?? ""));
      return link(parent, first < 0 ? parent.levels.length : first+1);
    }) : <p>{gradeOf(lesson.id) === 6 ? "Grade 5 whole-number operations, place value and fractions." : "Grade 7 integers, fractions, decimals and number lines."}</p>)}
    <h3>Builds toward</h3>{successor ?? (children.length ? children.map(s => link(s, 1)) : <p>{gradeOf(lesson.id) === 6 ? sixthTransfer[lesson.id.slice(3)] : transfer[lesson.id.slice(3)]}</p>)}
  </div>;
}
