import { useLocale, useTranslations } from 'next-intl';
import { formatRequestTime, type BookingRequest } from '../lib/booking';

export function RequestDetails({ request }: { request: BookingRequest }) {
  const locale = useLocale();
  const t = useTranslations('requestFlow');

  return (
    <div className="space-y-1 break-words">
      <h2 className="text-lg font-semibold">
        <bdi dir="ltr">{request.source_language} → {request.target_language}</bdi>
      </h2>
      <p className="text-sm text-slate-700">
        {request.domain} · {request.onsite_required ? request.city : t('remote')}
      </p>
      <time className="block text-sm text-slate-700" dateTime={request.scheduled_for}>
        {formatRequestTime(request.scheduled_for, locale)}
      </time>
      {request.notes && <p className="whitespace-pre-wrap text-sm" dir="auto">{request.notes}</p>}
    </div>
  );
}
