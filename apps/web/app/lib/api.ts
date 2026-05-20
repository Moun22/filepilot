const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (!parsed?.id || !parsed?.email) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      role: parsed.role ?? 'user',
    };
  } catch {
    return null;
  }
}

export function setSessionUser(user: SessionUser) {
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearSessionUser() {
  localStorage.removeItem('user');
}

function buildHeaders(init?: HeadersInit, contentType = true): Headers {
  const headers = new Headers(init);
  if (contentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const user = getSessionUser();
  if (user && !headers.has('x-user-id')) {
    headers.set('x-user-id', user.id);
  }
  return headers;
}

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: buildHeaders(options?.headers),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `API error ${res.status}`,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiFetchRaw(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const headers = new Headers(options?.headers);
  const user = getSessionUser();
  if (user && !headers.has('x-user-id')) headers.set('x-user-id', user.id);
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

export const API_BASE_URL = API_URL;
