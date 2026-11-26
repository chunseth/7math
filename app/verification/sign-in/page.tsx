import { databaseConfigured } from "../../../lib/mentalist/db";
import VerificationSignIn from "../SignIn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Page() {
  return <VerificationSignIn returnTo="/verification" available={databaseConfigured()} />;
}
