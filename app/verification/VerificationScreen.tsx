import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { databaseConfigured, GameError, identity, studentCookie, transaction } from "../../lib/mentalist/db";
import { verificationCatalog } from "../../lib/verification/catalog";
import { reviewProgress } from "../../lib/verification/server";
import VerificationTrail from "./VerificationTrail";

export default async function VerificationScreen() {
  const signIn = "/verification/sign-in";
  const token = (await cookies()).get(studentCookie)?.value;
  if (!token || !databaseConfigured()) redirect(signIn);

  try {
    const { set } = verificationCatalog();
    const { reviewer, progress } = await transaction(async db => {
      const who = await identity(db, token);
      return { reviewer: who.profile, progress: await reviewProgress(db, who, set.id) };
    });
    return <VerificationTrail key={reviewer + ":" + set.id} set={set} initial={progress} />;
  } catch (error) {
    if (error instanceof GameError && error.status === 401) redirect(signIn);
    console.error("Could not load verification set", (error as { code?: string })?.code);
    return <main className="mt-shell verify-gate">
      <Link href="/">← Main menu</Link>
      <h1>Verification</h1>
      <p role="alert">Review progress could not be loaded.</p>
      <a href="/verification">Retry loading Verification</a>
    </main>;
  }
}
