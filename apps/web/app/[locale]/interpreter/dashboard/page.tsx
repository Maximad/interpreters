'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { BookingSessionPanel } from '../../../../components/booking-session-panel';
import { InterpreterProfileStatus, type ProfileReview } from '../../../../components/interpreter-profile-status';
import { QuoteTerms } from '../../../../components/quote-terms';
import { RequestDetails } from '../../../../components/request-details';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { ApiError, errorMessage, requestJson } from '../../../../lib/api';
import type { BookingRequest } from '../../../../lib/booking';

type Invitation = { id: string; request: BookingRequest };

export default function InterpreterDashboardPage() {
  const t = useTranslations('requestFlow');
  const profile = useTranslations('profileWizard');
  const locale = useLocale();
  const pilot = useTranslations('pilot');
  const [review, setReview] = useState<ProfileReview | null>();
  const [reviewError, setReviewError] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quoteFeedback, setQuoteFeedback] = useState<{ id: string; message: string; failed: boolean } | null>(null);
  const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED' });

  const load = useCallback(() => requestJson<Invitation[]>('/dashboard/interpreter/requests', { authenticated: true })
    .then((items) => { setInvitations(items); setError(''); })
    .catch((reason: unknown) => setError(errorMessage(reason, t('loadError')))), [t]);

  const loadReview = useCallback(() => {
    void requestJson<ProfileReview>('/profile/me', { authenticated: true })
      .then((saved) => { setReview(saved); setReviewError(false); })
      .catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 404) {
          setReview(null);
          setReviewError(false);
        } else setReviewError(true);
      });
  }, []);

  useEffect(() => { void load(); loadReview(); }, [load, loadReview]);

  async function submit(requestId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formData = new FormData(event.currentTarget);
    const amountAed = Number(formData.get('amountAed'));
    const durationMinutes = Number(formData.get('durationMinutes'));
    const paymentTerms = String(formData.get('paymentTerms') ?? '').trim();
    const cancellationTerms = String(formData.get('cancellationTerms') ?? '').trim();
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
        method: 'POST', authenticated: true, body: JSON.stringify({ amountAed, durationMinutes, paymentTerms, cancellationTerms, message })
      });
      setQuoteFeedback({ id: requestId, message: t('quoteSaved'), failed: false });
      await load();
    } catch (reason) {
      const message = reason instanceof ApiError && reason.code === 'INVALID_QUOTE_TERMS'
        ? pilot('invalidQuote') : errorMessage(reason, t('quoteError'));
      setQuoteFeedback({ id: requestId, message, failed: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold">{t('interpreterDashboard')}</h1>
        <Button className="border border-slate-300 bg-white text-slate-800 hover:bg-slate-100" onClick={() => { void load(); loadReview(); }} type="button" disabled={busy}>{t('refresh')}</Button>
      </header>
      {review !== undefined && <InterpreterProfileStatus profile={review} />}
      {reviewError && <p role="alert" className="text-sm text-red-700">{profile('loadError')}</p>}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {invitations === null && !error && <p role="status">{t('loading')}</p>}
      {invitations?.length === 0 && review?.status === 'APPROVED' && <p>{t('noRequests')}</p>}
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
            {request.status === 'FILLED' && quote?.status === 'ACCEPTED' && (
              <>
                <QuoteTerms quote={quote} />
                <BookingSessionPanel request={request} onChange={(session) => {
                  setInvitations((current) => current?.map((item) => item.id === id ? { ...item, request: { ...item.request, session } } : item) ?? null);
                }} />
              </>
            )}
            {quoteFeedback?.id === request.id && (
              <p className={quoteFeedback.failed ? 'text-sm text-red-800' : 'text-sm text-emerald-800'} role={quoteFeedback.failed ? 'alert' : 'status'}>
                {quoteFeedback.message}
              </p>
            )}
            {request.status === 'OPEN' && (
              <form className="grid min-w-0 max-w-md gap-2" key={quote?.revision ?? 0} onSubmit={(event) => submit(request.id, event)}>
                <Label htmlFor={`amount-${id}`}>{t('quoteAmount')}</Label>
                <Input id={`amount-${id}`} type="number" inputMode="decimal" name="amountAed" min="0.01" max="99999999.99" step="0.01" defaultValue={quote?.amount_aed} required />
                <Label htmlFor={`duration-${id}`}>{pilot('durationMinutes')}</Label>
                <Input id={`duration-${id}`} type="number" inputMode="numeric" name="durationMinutes" min="1" max="1440" defaultValue={quote?.duration_minutes ?? ''} required />
                <Label htmlFor={`payment-${id}`}>{pilot('paymentTerms')}</Label>
                <Textarea id={`payment-${id}`} name="paymentTerms" defaultValue={quote?.payment_terms ?? ''} placeholder={pilot('paymentExample')} rows={2} maxLength={500} required />
                <Label htmlFor={`cancellation-${id}`}>{pilot('cancellationTerms')}</Label>
                <Textarea id={`cancellation-${id}`} name="cancellationTerms" defaultValue={quote?.cancellation_terms ?? ''} placeholder={pilot('cancellationExample')} rows={2} maxLength={500} required />
                <Label htmlFor={`message-${id}`}>{t('optionalMessage')}</Label>
                <Textarea id={`message-${id}`} name="message" defaultValue={quote?.message ?? ''} rows={2} minLength={3} maxLength={500} />
                <Button type="submit" disabled={busy}>{t(quote ? 'updateQuote' : 'submitQuote')}</Button>
              </form>
            )}
          </article>
        );
      })}
    </section>
  );
}
