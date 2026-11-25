'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { ApiError, requestJson } from '../lib/api';
import { formatRequestTime, type BookingRequest, type BookingSession } from '../lib/booking';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

const secondaryButton = 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100';

export function BookingSessionPanel({ request, canEdit = false, onChange }: {
  request: BookingRequest;
  canEdit?: boolean;
  onChange: (session: BookingSession) => void;
}) {
  const t = useTranslations('bookingSession');
  const locale = useLocale();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const detailsField = useRef<HTMLInputElement>(null);
  const cancelCompletion = useRef<HTMLButtonElement>(null);
  const markComplete = useRef<HTMLButtonElement>(null);
  const details = request.session?.details;
  const completed = request.session?.completed_at;
  const showEditor = canEdit && !completed && (editing || !details);
  const field = request.onsite_required ? 'location' : 'meetingLink';

  useEffect(() => { if (editing) detailsField.current?.focus(); }, [editing]);
  useEffect(() => { if (confirming) cancelCompletion.current?.focus(); }, [confirming]);

  async function update(details?: string) {
    if (busy) return;
    const saving = details !== undefined;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const path = `/requests/${request.id}/session`;
      const result = await requestJson<BookingSession>(saving ? path : `${path}/complete`, {
        method: saving ? 'PUT' : 'POST',
        authenticated: true,
        body: saving ? JSON.stringify({ details }) : undefined
      });
      onChange(result);
      if (saving) {
        setEditing(false);
        setNotice(t('detailsSaved'));
      } else {
        setConfirming(false);
      }
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        setError(t(saving ? 'alreadyCompleted' : 'completionTooEarly'));
      } else if (reason instanceof ApiError && reason.status === 400 && saving) {
        setError(t(request.onsite_required ? 'locationError' : 'linkError'));
      } else {
        setError(t('saveError'));
      }
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void update(String(new FormData(event.currentTarget).get('details') ?? '').trim());
  }

  return (
    <section className="space-y-3 rounded-lg bg-slate-50 p-3 sm:p-4" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="font-semibold">{t('title')}</h3>
      {showEditor ? (
        <form className="grid min-w-0 gap-2" onSubmit={save}>
          <Label htmlFor={`${id}-details`}>{t(field)}</Label>
          <Input
            ref={detailsField}
            id={`${id}-details`}
            name="details"
            type={request.onsite_required ? 'text' : 'url'}
            dir={request.onsite_required ? 'auto' : 'ltr'}
            defaultValue={details ?? ''}
            maxLength={1024}
            required
            aria-describedby={`${id}-sharing`}
          />
          <p className="text-sm text-slate-700" id={`${id}-sharing`}>{t('sharing')}</p>
          <div className="flex flex-wrap gap-2">
            <Button className="flex-1 sm:flex-none" type="submit" disabled={busy}>{t('saveDetails')}</Button>
            {details && (
              <Button className={secondaryButton} type="button" disabled={busy} onClick={() => { setEditing(false); setError(''); }}>
                {t('back')}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <>
          {details ? (
            request.onsite_required ? (
              <p className="break-words text-sm" dir="auto">{details}</p>
            ) : (
              <a className="inline-flex min-h-11 items-center font-medium text-blue-700 underline" href={details} target="_blank" rel="noopener noreferrer">
                {t('openLink')}
              </a>
            )
          ) : (
            <p className="text-sm text-slate-700">{t(completed ? 'noDetails' : 'waitingForDetails')}</p>
          )}
          {canEdit && details && !completed && (
            <div>
              <Button className={secondaryButton} type="button" disabled={busy} onClick={() => { setEditing(true); setConfirming(false); setNotice(''); setError(''); }}>
                {t('editDetails')}
              </Button>
            </div>
          )}
        </>
      )}
      {completed ? (
        <p className="text-sm font-medium text-emerald-800" role="status">
          {t('completedAt', { time: formatRequestTime(completed, locale) })}
        </p>
      ) : (
        (!showEditor || !details) && (
          <div className="space-y-2 border-t border-slate-200 pt-3">
            {confirming ? (
              <>
                <p className="text-sm">{t('confirmPrompt')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={busy} onClick={() => void update()}>{t('confirmCompletion')}</Button>
                  <Button ref={cancelCompletion} className={secondaryButton} type="button" disabled={busy} onClick={() => {
                    setConfirming(false);
                    setError('');
                    requestAnimationFrame(() => markComplete.current?.focus());
                  }}>
                    {t('back')}
                  </Button>
                </div>
              </>
            ) : (
              <Button ref={markComplete} className={secondaryButton} type="button" disabled={busy} onClick={() => { setConfirming(true); setNotice(''); setError(''); }}>
                {t('markComplete')}
              </Button>
            )}
          </div>
        )
      )}
      {error && <p className="text-sm text-red-800" role="alert">{error}</p>}
      {notice && <p className="text-sm text-emerald-800" role="status">{notice}</p>}
    </section>
  );
}
