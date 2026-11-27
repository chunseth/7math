import Link from "next/link";

const gameModes = [
  { href: "/6math", title: "6math", theme: "grade-6" },
  { href: "/skills", title: "Grade 7 Skills" },
  { href: "/7math", title: "7math" },
  { href: "/8math", title: "8math", theme: "grade-8" },
  { href: "/crafters", title: "Crafters" },
  { href: "/survivor", title: "Survivor", theme: "survivor" },
  { href: "/rush", title: "Rush", theme: "rush" },
];

export const dynamic = "force-dynamic";

export default function Home() {
  const curriculum = process.env.MENTALIST_CURRICULUM === "1";
  const modes = curriculum ? gameModes.filter(mode => mode.href !== "/skills") : gameModes;
  return (
    <main className="shell">
      <nav className="mode-menu" aria-labelledby="mode-menu-title">
        <div className="mode-menu-list">
          <h1 id="mode-menu-title">Main Menu</h1>
          {modes.map(mode => (
            <div className="mode-card" data-theme={mode.theme} key={mode.href}>
              <strong>{mode.title}</strong>
              <Link href={mode.href} aria-label={`Select ${mode.title}`}>Select</Link>
            </div>
          ))}
        </div>
      </nav>
    </main>
  );
}
