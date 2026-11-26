'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Link, useRouter } from '../../../i18n/navigation';
import { ApiError, requestJson } from '../../../lib/api';
import { dashboardPath, setSessionToken, useSession } from '../../../lib/auth-session';

export default function AccountPage() {
  const t = useTranslations('account');
  const nav = useTranslations('nav');
  const auth = useTranslations('auth');
  const router = useRouter();
  const session = useSession();
  const [emails, setEmails] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);

  useEffect(() => {
    if (session?.role !== 'INTERPRETER') return;
    const controller = new AbortController();
    requestJson<{ opt_out_broadcast_emails: boolean }>('/profile/me', { authenticated: true, signal: controller.signal })
      .then((profile) => setEmails(!profile.opt_out_broadcast_emails))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted && !(reason instanceof ApiError && reason.status === 404)) {
          setFeedback({ error: true, message: t('preferencesLoadError') });
        }
      });
    return () => controller.abort();
  }, [session?.role, session?.email, t]);

  async function save(next: boolean) {
    const previous = emails;
    setEmails(next);
    setBusy(true);
    setFeedback(null);
    try {
      await requestJson('/profile/broadcast-preferences', {
        method: 'PUT',
        authenticated: true,
        body: JSON.stringify({ optOutBroadcastEmails: !next })
      });
      setFeedback({ error: false, message: t('preferencesSaved') });
    } catch {
      setEmails(previous);
      setFeedback({ error: true, message: t('preferencesError') });
    } finally {
      setBusy(false);
    }
  }

  if (session === undefined) return <p role="status">{t('loading')}</p>;
  if (!session) return <Link className="text-forest underline" href="/auth/login">{auth('login')}</Link>;

  return (
    <section className="mx-auto max-w-xl space-y-5 rounded-2xl border border-line bg-white p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">{nav('accountSettings')}</h1>
      <dl className="grid gap-3">
        <div>
          <dt className="text-sm font-semibold">{auth('email')}</dt>
          <dd className="break-words text-quiet" dir="auto">{session.email}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold">{auth('role')}</dt>
          <dd className="text-quiet">{session.role === 'ADMIN' ? t('admin') : auth(session.role === 'CLIENT' ? 'client' : 'interpreter')}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-3 border-t border-line pt-3">
        <Link className="inline-flex min-h-11 items-center font-semibold text-forest underline" href={dashboardPath[session.role]}>{nav('dashboard')}</Link>
        {session.role === 'INTERPRETER' && <Link className="inline-flex min-h-11 items-center font-semibold text-forest underline" href="/interpreter/profile-wizard">{nav('myProfile')}</Link>}
      </div>
      {session.role === 'INTERPRETER' && emails !== null && (
        <div className="space-y-2 border-t border-line pt-4">
          <h2 className="font-semibold">{t('notifications')}</h2>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={emails} disabled={busy} onChange={(event) => void save(event.target.checked)} />
            {t('requestEmail')}
          </label>
        </div>
      )}
      {feedback && <p className={feedback.error ? 'text-sm text-red-800' : 'text-sm text-forest'} role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
      <Button type="button" className="border border-line bg-white text-forest hover:bg-mint" onClick={() => { setSessionToken(null); router.replace('/'); }}>
        {nav('logout')}
      </Button>
    </section>
  );
}
