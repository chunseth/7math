import Link from "next/link";
import { PreviewFeed } from "../components/PreviewFeed";
import "../trail.css";

export default function PreviewsPage() {
  return <main className="mt-shell mt-home">
    <header className="mt-top">
      <Link href="/mentalist" aria-label="Back to Mentalist">‹</Link>
      <strong>Mentalist</strong>
    </header>
    <PreviewFeed />
  </main>;
}
