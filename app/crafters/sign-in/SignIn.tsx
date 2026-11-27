"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { post } from "../../../lib/mentalist/client";
import { emptyCredentials, PlayerFields } from "../../mentalist/components/PlayerFields";

export default function SignIn({ next }: { next: string }) {
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await post({ action: "login", ...credentials, create });
      window.location.replace(next);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <main className="cf-shell cf-center">
      <section className="cf-card cf-login">
        <Link href="/">Game modes</Link>
        <h1>{create ? "Create a Crafters player" : "Sign in to Crafters"}</h1>
        <p>Crafters and 7math share the same player account.</p>
        <form onSubmit={signIn}>
          <PlayerFields value={credentials} onChange={setCredentials} create={create} busy={busy} />
          {error && <p role="alert">{error}</p>}
          <button disabled={busy}>{create ? "Create player" : "Sign in"}</button>
        </form>
        <button className="cf-plain" type="button" disabled={busy} onClick={() => {
          setCreate(!create);
          setError("");
        }}>
          {create ? "Use existing account" : "Create a player"}
        </button>
      </section>
    </main>
  );
}
