const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function requestJson<T>(path: string, options: RequestInit & { authenticated?: boolean } = {}): Promise<T> {
  const { authenticated, ...init } = options;
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (authenticated) {
    const token = localStorage.getItem('im_token');
    if (!token) throw new ApiError(401, '');
    headers.set('authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, typeof body?.message === 'string' ? body.message : '');
  }
  return response.json();
}

export type Lookup = { id: number; name: string };
export type ProfileOptions = { languages: Lookup[]; domains: Lookup[]; cities: Lookup[] };

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}
