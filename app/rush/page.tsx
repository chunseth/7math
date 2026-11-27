import { cookies } from "next/headers";
import { databaseConfigured, enabled, GameError, identity, studentCookie, transaction } from "../../lib/mentalist/db";
import Rush from "./Rush";
import "../mentalist/trail.css";
import "./rush.css";

export const metadata = { title: "Rush | 7Math Arena" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const available = enabled() && databaseConfigured();
  const token = (await cookies()).get(studentCookie)?.value;
  if (!available || !token) return <Rush available={available} hasSession={false} />;

  try {
    await transaction(db => identity(db, token));
    return <Rush available hasSession />;
  } catch (error) {
    if (!(error instanceof GameError && error.status === 401)) {
      console.error("Could not verify Rush session", error);
      return <Rush available={false} hasSession={false} />;
    }
    return <Rush available hasSession={false} />;
  }
}
