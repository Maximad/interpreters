'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookingSessionPanel } from '../../../../components/booking-session-panel';
import { hasQuoteTerms, QuoteTerms } from '../../../../components/quote-terms';
import { RequestDetails } from '../../../../components/request-details';
import { Button } from '../../../../components/ui/button';
import { Link } from '../../../../i18n/navigation';
import { ApiError, errorMessage, requestJson } from '../../../../lib/api';
import type { BookingRequest, Quote } from '../../../../lib/booking';

export default function ClientDashboardPage() {
  const t = useTranslations('requestFlow');
  const locale = useLocale();
  const pilot = useTranslations('pilot');
  const [requests, setRequests] = useState<BookingRequest[] | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [acceptedId, setAcceptedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancelButton = useRef<HTMLButtonElement>(null);
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED' });

  const load = useCallback(() => requestJson<BookingRequest[]>('/dashboard/client/requests', { authenticated: true })
    .then((items) => { setRequests(items); setError(''); })
    .catch((reason: unknown) => setError(errorMessage(reason, t('loadError')))), [t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (reviewId) cancelButton.current?.focus(); }, [reviewId]);

  async function accept(requestId: string, quote: Quote) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await requestJson(`/requests/${requestId}/quotes/${quote.id}/accept`, {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ expectedAmountAed: Number(quote.amount_aed), expectedRevision: quote.revision })
      });
      setReviewId(null);
      setAcceptedId(requestId);
      await load();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        setReviewId(null);
        await load();
        setError(reason.code === 'QUOTE_TERMS_REQUIRED' ? pilot('termsPending') : t('quoteReviewRequired'));
      } else {
        setError(errorMessage(reason, t('quoteError')));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold">{t('clientDashboard')}</h1>
        <Button className="border border-slate-300 bg-white text-slate-800 hover:bg-slate-100" onClick={load} type="button" disabled={busy}>{t('refresh')}</Button>
      </header>
      <Link className="inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white" href="/client/broadcast">{t('newRequest')}</Link>
      {error && <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</p>}
      {requests === null && !error && <p role="status">{t('loading')}</p>}
      {requests?.length === 0 && <p>{t('noRequests')}</p>}
      {requests?.map((item) => {
        const booked = item.status === 'FILLED' && item.quotes.some((quote) => quote.status === 'ACCEPTED');
        return (
          <article className="space-y-4 rounded-xl border bg-white p-4 sm:p-5" key={item.id}>
            <p className={booked ? 'text-sm font-semibold text-emerald-800' : 'text-sm font-medium text-slate-600'} role={acceptedId === item.id ? 'status' : undefined}>
              {t(booked ? 'bookingConfirmed' : `requestStatus.${item.status}`)}
            </p>
            <RequestDetails request={item} />
            {item.quotes.length === 0 && <p className="text-sm text-slate-700">{t('noQuotes')}</p>}
            {[...item.quotes].sort((a, b) => Number(b.status === 'ACCEPTED') - Number(a.status === 'ACCEPTED')).map((quote) => {
              const price = currency.format(Number(quote.amount_aed));
              return (
                <div className="space-y-2 break-words border-t pt-3" key={quote.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-semibold"><bdi>{quote.interpreter_profile?.user.full_name}</bdi></p>
                    <p className="font-semibold">{price}</p>
                  </div>
                  <p className="text-sm text-slate-700">{t(`quoteStatus.${quote.status}`)}</p>
                  <QuoteTerms quote={quote} />
                  {quote.message && <p className="whitespace-pre-wrap text-sm" dir="auto">{quote.message}</p>}
                  {item.status === 'OPEN' && quote.status === 'PENDING' && (
                    !hasQuoteTerms(quote) ? <p className="text-sm text-slate-700">{pilot('termsPending')}</p> :
                    reviewId === quote.id ? (
                      <div className="space-y-3 rounded-md bg-slate-100 p-3">
                        <p className="text-sm">{t('reviewQuote', { price })}</p>
                        <p className="text-sm">{pilot('clientInvoice')}</p>
                        <Link className="inline-flex min-h-11 items-center text-sm text-forest underline" href="/pilot">{pilot('policyTitle')}</Link>
                        <div className="flex flex-wrap gap-2">
                          <Button className="flex-1 sm:flex-none" disabled={busy} onClick={() => accept(item.id, quote)} type="button">
                            {t(busy ? 'confirmingQuote' : 'confirmQuote')}
                          </Button>
                          <Button className="flex-1 border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 sm:flex-none" ref={cancelButton} disabled={busy} onClick={() => {
                            setReviewId(null);
                            requestAnimationFrame(() => document.getElementById(`review-${quote.id}`)?.focus());
                          }} type="button">{t('backToQuotes')}</Button>
                        </div>
                      </div>
                    ) : (
                      <Button className="w-full sm:w-auto" disabled={busy} id={`review-${quote.id}`} onClick={() => setReviewId(quote.id)} type="button">{t('acceptQuote')}</Button>
                    )
                  )}
                </div>
              );
            })}
            {booked && (
              <BookingSessionPanel request={item} canEdit onChange={(session) => {
                setRequests((current) => current?.map((request) => request.id === item.id ? { ...request, session } : request) ?? null);
              }} />
            )}
          </article>
        );
      })}
    </section>
  );
}
