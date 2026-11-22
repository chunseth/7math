import type { RoundDraft } from "./round";

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function post<T>(body: Record<string, unknown>, token?: string): Promise<T> {
  const response = await fetch("/api/mentalist", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new RequestError(data.error ?? "Request failed.", response.status);
  return data;
}


// Each run owns its transcript. A second tab starting a new run cannot overwrite it.
export function storeRound(profile: string, draft: RoundDraft) {
  try {
    const key = "mentalist:round:" + profile;
    localStorage.setItem(key + ":" + draft.run.id, JSON.stringify(draft));
    localStorage.setItem(key, draft.run.id);
  } catch { /* Storage may be disabled; the battle still holds its transcript in memory. */ }
}
export function restoreRound(profile: string, active: string | null) {
  try {
    const key = "mentalist:round:" + profile;
    const id = active ?? localStorage.getItem(key);
    if (!id) return null;
    const draft = JSON.parse(localStorage.getItem(key + ":" + id) ?? "null") as RoundDraft | null;
    if (draft?.run.id === id && (active || draft.save)) return draft;
  } catch { /* The player can still start a fresh set. */ }
  return null;
}
export function discardRound(profile: string, id: string) {
  try {
    const key = "mentalist:round:" + profile;
    localStorage.removeItem(key + ":" + id);
    if (localStorage.getItem(key) === id) localStorage.removeItem(key);
  } catch { /* No saved transcript. */ }
}
