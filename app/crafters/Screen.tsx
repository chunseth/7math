import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadMining } from "../../lib/crafters/server";
import { enabled, GameError, identity, studentCookie, transaction } from "../../lib/mentalist/db";
import Game from "./Game";
import "./crafters.css";

export const miningPath = "/crafters";
const signInPath = "/crafters/sign-in";

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

export default async function Screen() {
  if (!enabled()) return <Unavailable href={miningPath} message="Crafters requires the 7math player sign-in." />;
  const token = (await cookies()).get(studentCookie)?.value;
  if (!token) redirect(signInPath);

  try {
    const initial = await transaction(async (db) => {
      const who = await identity(db, token);
      return loadMining(db, who.profile);
    });
    return <Game initial={initial} />;
  } catch (error) {
    if (error instanceof GameError && error.status === 401) redirect(signInPath);
    console.error("Could not load Crafters", (error as { code?: string })?.code);
    return <Unavailable href={miningPath} message="Could not load your Crafters progress." />;
  }
}
