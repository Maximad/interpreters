import { useSyncExternalStore } from 'react';

const tokenKey = 'im_token';
const sessionEvent = 'im:session';

export const dashboardPath = {
  CLIENT: '/client/dashboard',
  INTERPRETER: '/interpreter/dashboard',
  ADMIN: '/admin/profiles'
} as const;

type Session = { email: string; role: keyof typeof dashboardPath; exp: number };

export function getSessionToken() {
  return localStorage.getItem(tokenKey);
}

export function setSessionToken(token: string | null) {
  if (token) localStorage.setItem(tokenKey, token);
  else localStorage.removeItem(tokenKey);
  window.dispatchEvent(new Event(sessionEvent));
}

// These claims drive navigation. Authenticated requests are verified by the API.
function readClaims(token: string | null | undefined): Session | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload), (byte) => byte.charCodeAt(0))));
    if (typeof data.email === 'string' && Object.hasOwn(dashboardPath, data.role) && typeof data.exp === 'number') return data;
  } catch {
    // An old or malformed token has no navigation session.
  }
  return null;
}

function readActiveToken() {
  const token = getSessionToken();
  const session = readClaims(token);
  return session && session.exp * 1000 > Date.now() ? token : null;
}

function subscribe(notify: () => void) {
  window.addEventListener(sessionEvent, notify);
  window.addEventListener('storage', notify);
  window.addEventListener('focus', notify);
  return () => {
    window.removeEventListener(sessionEvent, notify);
    window.removeEventListener('storage', notify);
    window.removeEventListener('focus', notify);
  };
}

export function useSession() {
  const token = useSyncExternalStore(subscribe, readActiveToken, () => undefined);
  return token === undefined ? undefined : readClaims(token);
}
