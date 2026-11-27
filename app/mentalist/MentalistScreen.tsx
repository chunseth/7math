import { cookies } from "next/headers";
import { enabled, GameError, identity, studentCookie, transaction } from "../../lib/mentalist/db";
import { publishedLevelIds, studentState } from "../../lib/mentalist/student";
import Legacy from "./Legacy";
import Trail from "./Trail";

import Link from "next/link";
import { accessMap, type CourseGrade } from "../../lib/mentalist/model";
import { PreviewFeed } from "./components/PreviewFeed";

function PreviewLibrary() {
  return <main className="mt-shell mt-home mp-home">
    <PreviewFeed access={accessMap(new Set(), [], new Set(), new Set(), new Set())} obscured={false} />
    <nav className="mt-nav mp-library-nav" aria-label="7math menus">
      <Link href="/7math">Map</Link><span aria-current="page">More Topics</span>
    </nav>
  </main>;
}

export default async function MentalistScreen({initialTab, grade = 7}: {grade?: CourseGrade; initialTab: "Map" | "More Topics" | "Collection"}) {
  if (!enabled() && grade !== 7) return <Trail grade={grade} accounts={false} published={[]} initialStudent={null} initialTab={initialTab} />;
  if (!enabled()) return initialTab === "More Topics" ? <PreviewLibrary /> : <Legacy />;
  const token = (await cookies()).get(studentCookie)?.value;
  try {
    const initial = await transaction(async (db) => {
      if (token) {
        const who = await identity(db, token).catch((error) => {
          if (error instanceof GameError && error.status === 401) return null;
          throw error;
        });
        if (who) {
          const student = await studentState(db, who, grade);
          return {
            initialStudent: student,
            published: student.access.filter((level) => level.state !== "planned").map((level) => level.id),
          };
        }
      }
      return { initialStudent: null, published: await publishedLevelIds(db, grade) };
    });
    return <Trail grade={grade} {...initial} initialTab={initialTab} />;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "42P01" && error instanceof Error) {
      console.error("Could not load Mentalist trail", code, error.message);
    } else {
      console.error("Could not load Mentalist trail", code);
    }
    if (grade !== 7) return <Trail grade={grade} accounts={false} published={[]} initialStudent={null} initialTab={initialTab} />;
    if (initialTab === "More Topics") return <PreviewLibrary />;
    return (
      <main className="mt-shell mt-panel">
        <h1>7math</h1>
        <p role="alert">Lesson availability could not be loaded.</p>
        <a href="/7math">Retry loading the trail</a>
        <a href="/7math/previews">More Topics</a>
      </main>
    );
  }
}
