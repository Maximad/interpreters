'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { requestJson } from '../lib/api';
import { GoogleSignIn } from './google-sign-in';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function GoogleAccountLink() {
  const t = useTranslations('googleAuth');
  const [linked, setLinked] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void requestJson<{ linked: boolean }>('/auth/google/account', { authenticated: true, signal: controller.signal })
      .then((account) => setLinked(account.linked))
      .catch(() => { if (!controller.signal.aborted) setLinked(null); });
    return () => controller.abort();
  }, []);

  if (linked === null) return null;
  return (
    <section className="grid gap-2 border-t border-line pt-4">
      <h2 className="font-semibold">{t('accountHeading')}</h2>
      {linked ? <p className="text-sm text-forest" role="status">{t('linked')}</p> : (
        <>
          <Label htmlFor="google-link-password">{t('currentPassword')}</Label>
          <Input id="google-link-password" type="password" autoComplete="current-password" value={password}
            onChange={(event) => setPassword(event.target.value)} />
          <GoogleSignIn mode="link" password={password} onLinked={() => { setPassword(''); setLinked(true); }} />
        </>
      )}
    </section>
  );
}
