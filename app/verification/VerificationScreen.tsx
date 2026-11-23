import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { databaseConfigured, GameError, identity, studentCookie, transaction } from "../../lib/mentalist/db";
import type { CourseGrade } from "../../lib/mentalist/model";
import { verificationCatalog } from "../../lib/verification/catalog";
import { reviewProgress, reviewWorldSummaries } from "../../lib/verification/server";
import { verificationWorlds } from "../../lib/verification/model";
import VerificationTrail from "./VerificationTrail";
import ExportReports from "./ExportReports";

export default async function VerificationScreen({ grade }: { grade?: CourseGrade }) {
  const signInPath = grade ? `/verification/sign-in?grade=${grade}` : "/verification/sign-in";
  const token = (await cookies()).get(studentCookie)?.value;
  if (!token || !databaseConfigured()) redirect(signInPath);

  try {
    const data = await transaction(async db => {
      const who = await identity(db, token);
      if (grade) {
        const { world } = verificationCatalog(grade);
        return { world, progress: await reviewProgress(db, who, world), reviewer: who.profile };
      }
      return { summaries: await reviewWorldSummaries(db, who) };
    });

    if (data.world) return <VerificationTrail key={`${data.reviewer}:${data.world.grade}:${data.world.version}`} world={data.world} initial={data.progress} />;

    return <main className="mt-shell verify-home">
      <header className="verify-header">
        <Link href="/">← Main menu</Link>
        <ExportReports />
      </header>
      <h1>Verification Trail</h1>
      <p>Play the student questions, then accept each example or report what needs fixing.</p>
      <nav className="verify-worlds" aria-label="Verification worlds">
        {data.summaries.map(({ grade, accepted, flagged, total }) => {
          const world = verificationWorlds[grade];
          return <Link className={`verify-world verify-world-${grade}`} key={grade} href={`/verification/${grade}`}>
            <img src={`/sprites/${world.sprite}.png`} alt="" width="80" height="80" />
            <div>
              <small>Grade {grade}</small>
              <h2>{world.name}</h2>
              <p>{world.focus}</p>
              <progress value={accepted + flagged} max={total} aria-label={`Grade ${grade} review progress`} />
              <span>{accepted + flagged} of {total} reviewed{flagged > 0 && ` · ${flagged} flagged`}</span>
            </div>
          </Link>;
        })}
      </nav>
    </main>;
  } catch (error) {
    if (error instanceof GameError && error.status === 401) redirect(signInPath);
    console.error("Could not load verification trail", (error as { code?: string })?.code);
    return <main className="mt-shell verify-gate">
      <Link href="/">← Main menu</Link>
      <h1>Verification Trail</h1>
      <p role="alert">Review progress could not be loaded.</p>
      <a href={grade ? `/verification/${grade}` : "/verification"}>Retry loading the trail</a>
    </main>;
  }
}
