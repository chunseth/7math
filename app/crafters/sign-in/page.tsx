import { enabled } from "../../../lib/mentalist/db";
import { craftingPath, miningPath, Unavailable } from "../Screen";
import SignIn from "./SignIn";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!enabled()) return <Unavailable href={miningPath} message="Crafters requires the 7math player sign-in." />;
  const next = (await searchParams).next === "crafting" ? craftingPath : miningPath;
  return <SignIn next={next} />;
}
