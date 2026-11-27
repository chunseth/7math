import { cookies } from "next/headers";
import { databaseConfigured, enabled, GameError, identity, studentCookie, transaction } from "../../lib/mentalist/db";
import RushRivals from "./RushRivals";
import "../mentalist/trail.css";
import "../rush/rush.css";
import "./rivals.css";

export const metadata = { title: "Rush Rivals | 7Math Arena" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const available = enabled() && databaseConfigured();
  const token = (await cookies()).get(studentCookie)?.value;
  if (!available || !token) return <RushRivals available={available} hasSession={false} />;

  try {
    await transaction(db => identity(db, token));
    return <RushRivals available hasSession />;
  } catch (error) {
    if (error instanceof GameError && error.status === 401) return <RushRivals available hasSession={false} />;
    console.error("Could not verify Rush Rivals session", error);
    return <RushRivals available={false} hasSession={false} />;
  }
}
