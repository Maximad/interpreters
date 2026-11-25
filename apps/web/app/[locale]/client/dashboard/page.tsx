'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Link } from '../../../../i18n/navigation';
import { errorMessage, requestJson } from '../../../../lib/api';
import { formatRequestTime, type BookingRequest } from '../../../../lib/booking';

export default function ClientDashboardPage() {
  const t = useTranslations('requestFlow');
  const locale = useLocale();
  const [requests, setRequests] = useState<BookingRequest[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED' });

  const load = useCallback(() => requestJson<BookingRequest[]>('/dashboard/client/requests', { authenticated: true })
    .then((items) => { setRequests(items); setError(''); })
    .catch((reason: unknown) => setError(errorMessage(reason, t('loadError')))), [t]);

  useEffect(() => { void load(); }, [load]);

  async function accept(requestId: string, quoteId: string) {
    setBusy(true);
    setError('');
    try {
      await requestJson(`/requests/${requestId}/quotes/${quoteId}/accept`, { method: 'POST', authenticated: true });
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
        <h1 className="text-2xl font-semibold">{t('clientDashboard')}</h1>
        <Link className="text-blue-700 underline" href="/client/broadcast">{t('broadcastAction')}</Link>
        <Button onClick={load} type="button" disabled={busy}>{t('refresh')}</Button>
      </header>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {requests === null && !error && <p>{t('loading')}</p>}
      {requests?.length === 0 && <p>{t('noRequests')}</p>}
      {requests?.map((item) => (
        <article className="space-y-3 rounded-lg border bg-white p-5" key={item.id}>
          <h2 className="font-semibold" dir="ltr">{item.source_language} → {item.target_language}</h2>
          <p className="text-sm text-slate-600">
            {item.domain} · {item.onsite_required ? item.city : t('remote')} · {formatRequestTime(item.scheduled_for, locale)} · {t(`requestStatus.${item.status}`)}
          </p>
          {item.notes && <p>{item.notes}</p>}
          {item.quotes.length === 0 && <p>{t('noQuotes')}</p>}
          {item.quotes.map((quote) => (
            <div className="space-y-2 border-t pt-3" key={quote.id}>
              <p className="font-medium">{quote.interpreter_profile?.user.full_name} · {currency.format(Number(quote.amount_aed))} · {t(`quoteStatus.${quote.status}`)}</p>
              {quote.message && <p>{quote.message}</p>}
              {item.status === 'OPEN' && quote.status === 'PENDING' && (
                <Button disabled={busy} onClick={() => accept(item.id, quote.id)} type="button">{t('acceptQuote')}</Button>
              )}
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}
