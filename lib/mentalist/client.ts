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
