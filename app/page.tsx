import Link from "next/link";

const gameModes = [
  {
    description: "Explore the Grade 7 skill tree and try untimed practice with integers, decimals, fractions, percents, and equations.",
    href: "/skills",
    kicker: "Skill Practice",
    title: "Grade 7 Skills",
  },
  {
    description: "Quick mental math battles with Play, Map, and Numbers progression.",
    href: "/mentalist",
    kicker: "Current Mode",
    title: "Mentalist",
  },
  {
    description: "Explore resource sites, spend stamina to mine, and build an ore inventory.",
    href: "/crafters",
    kicker: "New Mode",
    title: "Crafters",
  },
];

export const dynamic="force-dynamic";
export default function Home() {
  const curriculum=process.env.MENTALIST_CURRICULUM==="1";
  const modes=curriculum?gameModes.filter(m=>m.href!=="/skills").map(m=>m.href==="/mentalist"?{...m,description:"Follow the Grade 7 trail, practice a concept, and collect skill cards."}:m):gameModes;
  return (
    <main className="shell mode-select-shell">
      <section className="mode-menu mode-select-menu">
        <div className="section-heading mode-menu-heading">
          <h2>Main Menu <span>CHOOSE A GAME MODE</span></h2>
        </div>

        <div className="mode-select-grid">
          {modes.map((mode) => (
            <article className="mode-card mode-select-card" key={mode.title}>
              <span className="mode-badge">{mode.kicker}</span>
              <strong>{mode.title}</strong>
              <small>{mode.description}</small>
              <Link href={mode.href}>Select</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
