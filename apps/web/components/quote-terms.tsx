'use client';

import { useTranslations } from 'next-intl';
import type { Quote } from '../lib/booking';

export function hasQuoteTerms(quote: Quote) {
  return Boolean(quote.duration_minutes && quote.payment_terms?.trim() && quote.cancellation_terms?.trim());
}

export function QuoteTerms({ quote }: { quote: Quote }) {
  const t = useTranslations('pilot');
  if (!hasQuoteTerms(quote)) return null;

  return (
    <dl className="grid min-w-0 gap-2 text-sm">
      <div>
        <dt className="font-semibold">{t('duration')}</dt>
        <dd>{t('durationValue', { minutes: quote.duration_minutes ?? 0 })}</dd>
      </div>
      <div>
        <dt className="font-semibold">{t('paymentTerms')}</dt>
        <dd className="whitespace-pre-wrap break-words" dir="auto">{quote.payment_terms}</dd>
      </div>
      <div>
        <dt className="font-semibold">{t('cancellationTerms')}</dt>
        <dd className="whitespace-pre-wrap break-words" dir="auto">{quote.cancellation_terms}</dd>
      </div>
    </dl>
  );
}
