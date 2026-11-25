'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { RequestDetails } from '../../../../components/request-details';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Link } from '../../../../i18n/navigation';
import { errorMessage, requestJson } from '../../../../lib/api';
import type { BookingRequest } from '../../../../lib/booking';

type Invitation = { id: string; request: BookingRequest };

export default function InterpreterDashboardPage() {
  const t = useTranslations('requestFlow');
  const profile = useTranslations('profileWizard');
  const locale = useLocale();
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quoteFeedback, setQuoteFeedback] = useState<{ id: string; message: string; failed: boolean } | null>(null);
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED' });

  const load = useCallback(() => requestJson<Invitation[]>('/dashboard/interpreter/requests', { authenticated: true })
    .then((items) => { setInvitations(items); setError(''); })
    .catch((reason: unknown) => setError(errorMessage(reason, t('loadError')))), [t]);

  useEffect(() => { void load(); }, [load]);

  async function submit(requestId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formData = new FormData(event.currentTarget);
    const amountAed = Number(formData.get('amountAed'));
    const message = String(formData.get('message') ?? '').trim() || undefined;
    setQuoteFeedback(null);
    if (message && message.length < 3) {
      setQuoteFeedback({ id: requestId, message: t('quoteMessageTooShort'), failed: true });
      return;
    }
    setBusy(true);
    setError('');
    try {
      await requestJson(`/requests/${requestId}/quotes`, {
        method: 'POST', authenticated: true, body: JSON.stringify({ amountAed, message })
      });
      setQuoteFeedback({ id: requestId, message: t('quoteSaved'), failed: false });
      await load();
    } catch (reason) {
      setQuoteFeedback({ id: requestId, message: errorMessage(reason, t('quoteError')), failed: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold">{t('interpreterDashboard')}</h1>
        <Button className="border border-slate-300 bg-white text-slate-800 hover:bg-slate-100" onClick={load} type="button" disabled={busy}>{t('refresh')}</Button>
      </header>
      <Link className="inline-flex min-h-11 items-center font-medium text-blue-700 underline" href="/interpreter/profile-wizard">{profile('title')}</Link>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {invitations === null && !error && <p role="status">{t('loading')}</p>}
      {invitations?.length === 0 && <p>{t('noRequests')}</p>}
      {invitations?.map(({ id, request }) => {
        const quote = request.quotes[0];
        return (
          <article className="space-y-4 rounded-xl border bg-white p-4 sm:p-5" key={id}>
            <p className={quote?.status === 'ACCEPTED' ? 'text-sm font-semibold text-emerald-800' : 'text-sm font-medium text-slate-600'}>
              {t(quote?.status === 'ACCEPTED' ? 'bookingConfirmed' : request.status === 'FILLED' ? 'bookedElsewhere' : `requestStatus.${request.status}`)}
            </p>
            <RequestDetails request={request} />
            {quote && (
              <p className="border-t pt-3 font-medium">
                {currency.format(Number(quote.amount_aed))} · {t(`quoteStatus.${quote.status}`)}
              </p>
            )}
            {quoteFeedback?.id === request.id && (
              <p className={quoteFeedback.failed ? 'text-sm text-red-800' : 'text-sm text-emerald-800'} role={quoteFeedback.failed ? 'alert' : 'status'}>
                {quoteFeedback.message}
              </p>
            )}
            {request.status === 'OPEN' && (
              <form className="grid min-w-0 max-w-md gap-2" key={JSON.stringify([quote?.amount_aed, quote?.message])} onSubmit={(event) => submit(request.id, event)}>
                <Label htmlFor={`amount-${id}`}>{t('quoteAmount')}</Label>
                <Input id={`amount-${id}`} type="number" inputMode="decimal" name="amountAed" min="0.01" step="0.01" defaultValue={quote?.amount_aed} required />
                <Label htmlFor={`message-${id}`}>{t('optionalMessage')}</Label>
                <Textarea id={`message-${id}`} name="message" defaultValue={quote?.message ?? ''} rows={2} />
                <Button type="submit" disabled={busy}>{t(quote ? 'updateQuote' : 'submitQuote')}</Button>
              </form>
            )}
          </article>
        );
      })}
    </section>
  );
}
