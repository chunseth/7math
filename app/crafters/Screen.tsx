import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { craft } from "../../lib/mentalist/craft";
import { enabled, GameError, identity, studentCookie, transaction } from "../../lib/mentalist/db";
import Game from "./Game";
import "./crafters.css";

export type View = "mining" | "crafting";
export const miningPath = "/crafters";
export const craftingPath = "/crafters/crafting";

export function signInPath(view: View) {
  return view === "crafting" ? "/crafters/sign-in?next=crafting" : "/crafters/sign-in";
}

export function Unavailable({ href, message }: { href: string; message: string }) {
  return (
    <main className="cf-shell cf-center">
      <section className="cf-card cf-login">
        <h1>Crafters</h1>
        <p role="alert">{message}</p>
        <div className="cf-links"><Link href="/">Game modes</Link><Link href={href}>Retry</Link></div>
      </section>
    </main>
  );
}

export default async function Screen({ view }: { view: View }) {
  const path = view === "mining" ? miningPath : craftingPath;
  if (!enabled()) return <Unavailable href={path} message="Crafters requires the 7math player sign-in." />;
  const token = (await cookies()).get(studentCookie)?.value;
  if (!token) redirect(signInPath(view));

  try {
    const initial = await transaction(async (db) => {
      const who = await identity(db, token);
      return craft(db, who, { action: "craftState" });
    });
    return <Game key={view} view={view} initial={initial} />;
  } catch (error) {
    if (error instanceof GameError && error.status === 401) redirect(signInPath(view));
    console.error("Could not load Crafters", (error as { code?: string })?.code);
    return <Unavailable href={path} message="Could not load your Crafters progress." />;
  }
}
