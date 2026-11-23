import { databaseConfigured } from "../../../lib/mentalist/db";
import VerificationSignIn from "../SignIn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ grade?: string | string[] }> }) {
  const { grade } = await searchParams;
  const returnTo = grade === "6" || grade === "7" || grade === "8" ? `/verification/${grade}` : "/verification";
  return <VerificationSignIn returnTo={returnTo} available={databaseConfigured()} />;
}
