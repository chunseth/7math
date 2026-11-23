import { cookies } from "next/headers";
import { enabled, studentCookie } from "../../lib/mentalist/db";
import Rush from "./Rush";
import "../mentalist/trail.css";
import "./rush.css";

export const metadata = { title: "Rush | 7Math Arena" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const rankingEnabled = enabled() && Boolean(process.env.MENTALIST_DATABASE_URL);
  const hasSession = rankingEnabled && (await cookies()).has(studentCookie);
  return <Rush rankingEnabled={rankingEnabled} hasSession={hasSession} />;
}
