"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { post } from "../../lib/mentalist/client";
import { emptyCredentials, PlayerFields } from "../mentalist/components/PlayerFields";

export default function VerificationSignIn({ returnTo, available }: { returnTo: string; available: boolean }) {
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !available) return;
    setBusy(true);
    setError("");
    try {
      await post({ action: "verificationLogin", username: credentials.username, pin: credentials.pin });
      window.location.replace(returnTo);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return <main className="mt-shell verify-gate">
    <Link href="/">← Main menu</Link>
    <h1>Sign in to Verification</h1>
    <p>Sign in with your 7math player account to review questions and save your progress.</p>
    {!available && <p id="verification-unavailable" role="status">This deployment needs a verification database before sign-in can work.</p>}
    <form onSubmit={signIn}>
      <fieldset className="verify-login-fields" disabled={busy || !available} aria-describedby={available ? undefined : "verification-unavailable"}>
        <PlayerFields value={credentials} onChange={setCredentials} create={false} />
        <button className="mt-primary">{busy ? "Signing in…" : "Sign in"}</button>
      </fieldset>
    </form>
    {error && <p role="alert">{error}</p>}
  </main>;
}
