"use client";

import { useState, type FormEvent } from "react";
import { post } from "../../lib/mentalist/client";
import { emptyCredentials, PlayerFields } from "../mentalist/components/PlayerFields";

export default function AccountGate({ mode = "Rush", onSuccess }: { mode?: string; onSuccess: () => void }) {
  const [create, setCreate] = useState(false);
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await post({ action: "login", ...credentials, create });
      onSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return <section className="rush-card rush-account" aria-labelledby="rush-account-title">
    <h2 id="rush-account-title">{create ? "Create a player" : `Sign in to ${mode}`}</h2>
    <form onSubmit={submit}>
      <fieldset className="rush-account-fields" disabled={busy}>
        <PlayerFields value={credentials} onChange={setCredentials} create={create} />
        <button className="rush-action" type="submit">{busy ? (create ? "Creating player…" : "Signing in…") : create ? "Create player" : "Sign in"}</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
    <button type="button" disabled={busy} onClick={() => {
      setCreate(!create);
      setError("");
    }}>{create ? "Sign in instead" : "Create a player"}</button>
  </section>;
}
