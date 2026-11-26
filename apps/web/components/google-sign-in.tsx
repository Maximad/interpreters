'use client';

import Script from 'next/script';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '../i18n/navigation';
import { ApiError, requestJson } from '../lib/api';
import { dashboardPath, setSessionToken } from '../lib/auth-session';

const errorKeys = [
  'tryLater', 'expired', 'verifyEmail', 'useNassPassword', 'chooseRole', 'useVerifiedGoogleEmail',
  'accountExists', 'passwordRequired', 'differentGoogleAccount', 'alreadyLinked'
] as const;

type Challenge = { clientId: string; nonce: string };
type Mode = 'login' | 'register' | 'link';
type Options = {
  mode: Mode;
  role?: 'CLIENT' | 'INTERPRETER';
  password?: string;
  onLinked?: () => void;
};

type GoogleIdentity = {
  initialize: (config: {
    client_id: string;
    nonce: string;
    callback: (response: { credential: string }) => void;
  }) => void;
  renderButton: (element: HTMLElement, config: { width: number; size: 'large'; text: 'continue_with'; locale: string }) => void;
};

function identitySdk() {
  return (window as Window & { google?: { accounts: { id: GoogleIdentity } } }).google?.accounts.id;
}

export function GoogleSignIn({ mode, role, password, onLinked }: Options) {
  const t = useTranslations('googleAuth');
  const locale = useLocale();
  const router = useRouter();
  const target = useRef<HTMLDivElement>(null);
  const options = useRef<Options>({ mode, role, password, onLinked });
  const inFlight = useRef(false);
  const [ready, setReady] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { options.current = { mode, role, password, onLinked }; }, [mode, role, password, onLinked]);

  useEffect(() => {
    const controller = new AbortController();
    void requestJson<Challenge>('/auth/google/challenge', { signal: controller.signal })
      .then(setChallenge)
      .catch(() => { if (!controller.signal.aborted) setChallenge(null); });
    return () => controller.abort();
  }, [attempt]);

  const receive = useCallback(async (credential: string) => {
    if (inFlight.current) return;
    const { mode, role, password, onLinked } = options.current;
    if (mode === 'link' && (!password || password.length < 8)) {
      setError(t('passwordRequired'));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      if (mode === 'link') {
        await requestJson('/auth/google/link', {
          method: 'POST', authenticated: true, body: JSON.stringify({ credential, password })
        });
        onLinked?.();
      } else {
        const data = await requestJson<{ token: string; user: { role: keyof typeof dashboardPath } }>('/auth/google/sign-in', {
          method: 'POST', body: JSON.stringify({ credential, ...(mode === 'register' ? { role } : {}) })
        });
        setSessionToken(data.token);
        router.replace(dashboardPath[data.user.role]);
      }
    } catch (reason) {
      const code = reason instanceof ApiError ? reason.code : undefined;
      setError(t(errorKeys.find((key) => key === code) ?? 'failed'));
      setChallenge(null);
      setAttempt((previous) => previous + 1);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [router, t]);

  useEffect(() => {
    const element = target.current;
    const sdk = identitySdk();
    if (!ready || !challenge || !element || !sdk) return;
    sdk.initialize({
      client_id: challenge.clientId,
      nonce: challenge.nonce,
      callback: ({ credential }) => { void receive(credential); }
    });
    sdk.renderButton(element, { width: Math.min(320, element.clientWidth), size: 'large', text: 'continue_with', locale });
    return () => element.replaceChildren();
  }, [challenge, locale, ready, receive]);

  if (!challenge && !error) return null;
  return (
    <div className="space-y-2" aria-busy={busy}>
      {challenge && (
        <>
          <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setError(t('failed'))} />
          <div ref={target} className="w-full" />
        </>
      )}
      {busy && <p className="text-sm text-quiet" role="status">{t('working')}</p>}
      {error && <p className="text-sm text-red-800" role="alert">{error}</p>}
    </div>
  );
}
