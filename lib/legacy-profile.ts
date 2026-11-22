// Legacy game modes use a browser-selected profile, not a server-authenticated session.
const key = "activeProfileId";

export function getActiveProfileId(): string | null {
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  // Carry an existing tab session forward when the app is upgraded.
  const previous = sessionStorage.getItem(key);
  if (previous) {
    localStorage.setItem(key, previous);
    sessionStorage.removeItem(key);
  }
  return previous;
}

export function setActiveProfileId(id: string): void {
  localStorage.setItem(key, id);
  sessionStorage.removeItem(key);
}

export function clearActiveProfileId(): void {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}
