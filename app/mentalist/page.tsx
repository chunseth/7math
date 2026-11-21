import { cookies } from "next/headers";
import { enabled, GameError, identity, studentCookie, transaction } from "../../lib/mentalist/db";
import { publishedLevelIds, studentState } from "../../lib/mentalist/student";
import Legacy from "./Legacy";
import Trail from "./Trail";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!enabled()) return <Legacy />;
  const token = (await cookies()).get(studentCookie)?.value;
  try {
    const initial = await transaction(async (db) => {
      if (token) {
        const who = await identity(db, token).catch((error) => {
          if (error instanceof GameError && error.status === 401) return null;
          throw error;
        });
        if (who) {
          const student = await studentState(db, who);
          return {
            initialStudent: student,
            published: student.access.filter((level) => level.state !== "planned").map((level) => level.id),
          };
        }
      }
      return { initialStudent: null, published: await publishedLevelIds(db) };
    });
    return <Trail {...initial} />;
  } catch (error) {
    console.error("Could not load Mentalist trail", (error as { code?: string })?.code);
    return (
      <main className="mt-shell mt-panel">
        <h1>Mentalist</h1>
        <p role="alert">Lesson availability could not be loaded.</p>
        <a href="/mentalist">Retry loading the trail</a>
      </main>
    );
  }
}
