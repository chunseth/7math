"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { post } from "../../lib/mentalist/client";
import { emptyCredentials, PlayerFields } from "../mentalist/components/PlayerFields";

export default function VerificationSignIn() {
  const router = useRouter();
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await post({ action: "login", ...credentials, create: false });
      setCredentials(emptyCredentials);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return <main className="mt-shell verify-gate">
    <Link href="/">← Main menu</Link>
    <h1>Verification Trail</h1>
    <p>Sign in with your 7math player account to review questions and save your progress.</p>
    <form onSubmit={signIn}>
      <PlayerFields value={credentials} onChange={setCredentials} create={false} />
      <button className="mt-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
    {error && <p role="alert">{error}</p>}
  </main>;
}
