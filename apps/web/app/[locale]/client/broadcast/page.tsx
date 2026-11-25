'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select } from '../../../../components/ui/select';
import { Textarea } from '../../../../components/ui/textarea';
import { Link } from '../../../../i18n/navigation';
import { errorMessage, requestJson, type ProfileOptions } from '../../../../lib/api';

export default function BroadcastRequestPage() {
  const t = useTranslations('requestFlow');
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [onsite, setOnsite] = useState(false);
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const confirmation = useRef<HTMLHeadingElement>(null);

  const loadOptions = useCallback(() => {
    void requestJson<ProfileOptions>('/profile/options')
      .then(setOptions)
      .catch(() => setError({ message: t('optionsError') }));
  }, [t]);

  useEffect(loadOptions, [loadOptions]);
  useEffect(() => { if (error) errorSummary.current?.focus(); }, [error]);
  useEffect(() => { if (matchedCount !== null) confirmation.current?.focus(); }, [matchedCount]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formData = new FormData(event.currentTarget);
    const value = (key: string) => String(formData.get(key) ?? '');
    setError(null);

    if (value('sourceLanguage') === value('targetLanguage')) {
      setError({ message: t('differentLanguages'), field: 'targetLanguage' });
      return;
    }
    const notes = value('notes').trim();
    if (notes && notes.length < 5) {
      setError({ message: t('detailsTooShort'), field: 'notes' });
      return;
    }
    setBusy(true);
    try {
      const result = await requestJson<{ matchedCount: number }>('/requests/broadcast', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({
          sourceLanguage: value('sourceLanguage'),
          targetLanguage: value('targetLanguage'),
          domain: value('domain'),
          city: onsite ? value('city') : undefined,
          onsiteRequired: onsite,
          remoteAllowed: !onsite,
          scheduledFor: new Date(value('scheduledFor')).toISOString(),
          notes: notes || undefined
        })
      });
      setMatchedCount(result.matchedCount);
    } catch (reason) {
      setError({ message: errorMessage(reason, t('broadcastError')) });
    } finally {
      setBusy(false);
    }
  }

  if (matchedCount !== null) {
    return (
      <section className="mx-auto max-w-xl space-y-4 rounded-xl border bg-white p-4 sm:p-6">
        <h1 className="text-2xl font-semibold" tabIndex={-1} ref={confirmation}>{t('requestSaved')}</h1>
        <p>{matchedCount === 0 ? t('noMatches') : t('matchedCount', { count: matchedCount })}</p>
        <Link className="inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white" href="/client/dashboard">
          {t('clientDashboard')}
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl space-y-5 rounded-xl border bg-white p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">{t('broadcastTitle')}</h1>
      {error && (
        <div className="space-y-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert" tabIndex={-1} ref={errorSummary}>
          {error.field ? <a className="block min-h-6 underline" href={`#${error.field}`}>{error.message}</a> : <p>{error.message}</p>}
          {!options && <Button type="button" onClick={() => {
            setError(null);
            loadOptions();
          }}>{t('retry')}</Button>}
        </div>
      )}
      {options ? (
        <form onSubmit={submit} className="grid min-w-0 gap-4">
          {[
            { field: 'sourceLanguage', items: options.languages },
            { field: 'targetLanguage', items: options.languages },
            { field: 'domain', items: options.domains }
          ].map(({ field, items }) => (
            <div className="grid min-w-0 gap-1.5" key={field}>
              <Label htmlFor={field}>{t(field)}</Label>
              <Select id={field} name={field} defaultValue="" required aria-invalid={error?.field === field || undefined} aria-describedby={error?.field === field ? `${field}-error` : undefined}>
                <option value="" disabled>{t('choose')}</option>
                {items.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </Select>
              {error?.field === field && <p className="text-sm text-red-800" id={`${field}-error`}>{error.message}</p>}
            </div>
          ))}
          <div className="grid gap-1.5">
            <Label htmlFor="mode">{t('mode')}</Label>
            <Select id="mode" name="mode" value={onsite ? 'onsite' : 'remote'} onChange={(event) => setOnsite(event.target.value === 'onsite')}>
              <option value="remote">{t('remote')}</option>
              <option value="onsite">{t('onsite')}</option>
            </Select>
          </div>
          {onsite && (
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="city">{t('city')}</Label>
              <Select id="city" name="city" defaultValue="" required>
                <option value="" disabled>{t('choose')}</option>
                {options.cities.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </Select>
            </div>
          )}
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="scheduledFor">{t('scheduledFor')}</Label>
            <Input id="scheduledFor" name="scheduledFor" type="datetime-local" required aria-describedby="request-time-hint" />
            <p className="text-sm text-slate-600" id="request-time-hint">
              {t('timeZoneHint', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">{t('optionalDetails')}</Label>
            <Textarea id="notes" name="notes" rows={3} aria-invalid={error?.field === 'notes' || undefined} aria-describedby={error?.field === 'notes' ? 'notes-error' : undefined} />
            {error?.field === 'notes' && <p className="text-sm text-red-800" id="notes-error">{error.message}</p>}
          </div>
          <Button type="submit" disabled={busy}>{t(busy ? 'sendingRequest' : 'broadcastAction')}</Button>
        </form>
      ) : !error && <p role="status">{t('loading')}</p>}
    </section>
  );
}
