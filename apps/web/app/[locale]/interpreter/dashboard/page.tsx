'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Link } from '../../../../i18n/navigation';
import { errorMessage, requestJson } from '../../../../lib/api';
import { formatRequestTime, type BookingRequest } from '../../../../lib/booking';

type Invitation = { id: string; request: BookingRequest };

export default function InterpreterDashboardPage() {
  const t = useTranslations('requestFlow');
  const profile = useTranslations('profileWizard');
  const locale = useLocale();
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED' });

  const load = useCallback(() => requestJson<Invitation[]>('/dashboard/interpreter/requests', { authenticated: true })
    .then((items) => { setInvitations(items); setError(''); })
    .catch((reason: unknown) => setError(errorMessage(reason, t('loadError')))), [t]);

  useEffect(() => { void load(); }, [load]);

  async function submit(requestId: string, formData: FormData) {
    const amountAed = Number(formData.get('amountAed'));
    const message = String(formData.get('message') ?? '').trim() || undefined;
    setBusy(true);
    setError('');
    try {
      await requestJson(`/requests/${requestId}/quotes`, {
        method: 'POST', authenticated: true, body: JSON.stringify({ amountAed, message })
      });
      await load();
    } catch (reason) {
      setError(errorMessage(reason, t('quoteError')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold">{t('interpreterDashboard')}</h1>
        <Link className="text-blue-700 underline" href="/interpreter/profile-wizard">{profile('title')}</Link>
        <Button onClick={load} type="button" disabled={busy}>{t('refresh')}</Button>
      </header>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {invitations === null && !error && <p>{t('loading')}</p>}
      {invitations?.length === 0 && <p>{t('noRequests')}</p>}
      {invitations?.map(({ id, request }) => {
        const quote = request.quotes[0];
        return (
          <article className="space-y-3 rounded-lg border bg-white p-5" key={id}>
            <h2 className="font-semibold" dir="ltr">{request.source_language} → {request.target_language}</h2>
            <p className="text-sm text-slate-600">
              {request.domain} · {request.onsite_required ? request.city : t('remote')} · {formatRequestTime(request.scheduled_for, locale)} · {t(`requestStatus.${request.status}`)}
            </p>
            {request.notes && <p>{request.notes}</p>}
            {quote && <p>{currency.format(Number(quote.amount_aed))} · {t(`quoteStatus.${quote.status}`)}</p>}
            {request.status === 'OPEN' && (
              <form className="grid max-w-md gap-2" key={quote?.amount_aed} action={(formData) => submit(request.id, formData)}>
                <Label htmlFor={`amount-${id}`}>{t('quoteAmount')}</Label>
                <Input id={`amount-${id}`} type="number" name="amountAed" min="0.01" step="0.01" defaultValue={quote?.amount_aed} required />
                <Label htmlFor={`message-${id}`}>{t('message')}</Label>
                <Textarea id={`message-${id}`} name="message" defaultValue={quote?.message ?? ''} minLength={3} />
                <Button type="submit" disabled={busy}>{t(quote ? 'updateQuote' : 'submitQuote')}</Button>
              </form>
            )}
          </article>
        );
      })}
    </section>
  );
}
