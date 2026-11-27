import Link from "next/link";
import { enabled } from "../../lib/mentalist/db";
import Survivor from "./Survivor";
import "./survivor.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Survivor | 7Math Arena" };

export default function Page() {
  if (!enabled()) return <main className="sv-shell sv-lobby">
    <Link className="sv-back" href="/">← Main menu</Link>
    <section className="sv-entry-panel" aria-labelledby="survivor-title">
      <h1 id="survivor-title">Survivor</h1>
      <p>Survivor needs the signed-in 7math trail to load questions from your completed concepts.</p>
      <p>The 7math trail is disabled on this deployment.</p>
    </section>
  </main>;
  return <Survivor />;
}
