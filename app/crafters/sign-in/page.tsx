import { enabled } from "../../../lib/mentalist/db";
import { miningPath, Unavailable } from "../Screen";
import SignIn from "./SignIn";

export const dynamic = "force-dynamic";

export default function Page() {
  if (!enabled()) return <Unavailable href={miningPath} message="Crafters requires the 7math player sign-in." />;
  return <SignIn next={miningPath} />;
}
