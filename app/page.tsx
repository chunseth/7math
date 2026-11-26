import Link from "next/link";

const gameModes = [
  {
    description: "Practice rational numbers, ratios, equations, geometry, statistics, and personal finance.",
    href: "/6math", kicker: "Grade 6", title: "6math",
  },
  {
    description: "Explore the Grade 7 skill tree and try untimed practice with integers, decimals, fractions, percents, and equations.",
    href: "/skills",
    kicker: "Skill Practice",
    title: "Grade 7 Skills",
  },
  {
    description: "Quick mental math battles with Play, Map, and Numbers progression.",
    href: "/7math",
    kicker: "Current Mode",
    title: "7math",
  },
  {
    description: "Explore Grade 8 mathematics, watch worked examples, and practice each lesson.",
    href: "/8math", kicker: "Grade 8", title: "8math",
  },
  {
    description: "Test question formats from all three grades in one review set.",
    href: "/verification", kicker: "Curriculum Review", title: "Verification",
  },
  {
    description: "Spend energy to mine ore, then craft pickaxes and swords for your player.",
    href: "/crafters",
    kicker: "New Mode",
    title: "Crafters",
  },
  {
    description: "Clear a full 7math concept to unlock Survivor. Dodge enemy fire and solve math to fight the boss.",
    href: "/survivor",
    kicker: "Arena Survival",
    title: "Survivor",
  },
  {
    description: "Race through 12 random questions from Grades 6–8 and see where you rank.",
    href: "/rush",
    kicker: "Timed Challenge",
    title: "Rush",
  },
];

export const dynamic="force-dynamic";
export default function Home() {
  const curriculum=process.env.MENTALIST_CURRICULUM==="1";
  const modes = curriculum ? gameModes.filter(mode => mode.href !== "/skills") : gameModes;
  return (
    <main className="shell mode-select-shell">
      <section className="mode-menu mode-select-menu">
        <div className="section-heading mode-menu-heading">
          <h2>Main Menu <span>CHOOSE A GAME MODE</span></h2>
        </div>

        <div className="mode-select-grid">
          {modes.map((mode) => (
            <article className={`mode-card mode-select-card${mode.href === "/survivor" ? " mode-select-survivor" : ""}${mode.href === "/rush" ? " mode-select-rush" : ""}`} key={mode.title}>
              <span className="mode-badge">{mode.kicker}</span>
              <strong>{mode.title}</strong>
              <small>{curriculum && mode.href === "/7math" ? "Follow the Grade 7 trail, practice a concept, and collect topic cards." : mode.description}</small>
              <Link href={mode.href} aria-label={`Select ${mode.title}`}>Select</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
