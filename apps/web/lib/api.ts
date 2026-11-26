import { getSessionToken, setSessionToken } from './auth-session';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
  }
}

export async function requestJson<T>(path: string, options: RequestInit & { authenticated?: boolean } = {}): Promise<T> {
  const { authenticated, ...init } = options;
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  const token = authenticated ? getSessionToken() : null;
  if (authenticated) {
    if (!token) throw new ApiError(401, '');
    headers.set('authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  if (!response.ok) {
    if (token && response.status === 401 && token === getSessionToken()) setSessionToken(null);
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, typeof body?.message === 'string' ? body.message : '', typeof body?.code === 'string' ? body.code : undefined);
  }
  return response.json();
}

export type Lookup = { id: number; name: string; label?: string };
export type ProfileOptions = { languages: Lookup[]; directoryLanguages: Lookup[]; domains: Lookup[]; cities: Lookup[] };

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}
