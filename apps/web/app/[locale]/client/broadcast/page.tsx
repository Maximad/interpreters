'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select } from '../../../../components/ui/select';
import { Textarea } from '../../../../components/ui/textarea';
import { Link } from '../../../../i18n/navigation';
import { ApiError, errorMessage, requestJson, type ProfileOptions } from '../../../../lib/api';

type RequestOptions = Pick<ProfileOptions, 'domains' | 'cities'>;
type LanguagePair = { source: string; target: string; sourceLabel?: string; targetLabel?: string };
type Scope = { onsite: boolean; city: string; domain: string };

export default function BroadcastRequestPage() {
  const t = useTranslations('requestFlow');
  const [options, setOptions] = useState<RequestOptions | null>();
  const [optionAttempt, setOptionAttempt] = useState(0);
  const [scope, setScope] = useState<Scope>({ onsite: false, city: '', domain: '' });
  const [availability, setAvailability] = useState<{ key: string; pairs: LanguagePair[] | null }>();
  const [pairAttempt, setPairAttempt] = useState(0);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const confirmation = useRef<HTMLHeadingElement>(null);

  const query = scope.domain && (!scope.onsite || scope.city)
    ? new URLSearchParams({ domain: scope.domain, ...(scope.onsite ? { city: scope.city } : {}) }).toString()
    : '';
  const key = query && `${pairAttempt}:${query}`;
  const pairs = availability?.key === key ? availability?.pairs : undefined;
  const sources = new Map(pairs?.map((pair) => [pair.source, pair.sourceLabel ?? pair.source]));
  const targets = new Map(pairs?.filter((pair) => pair.source === source)
    .map((pair) => [pair.target, pair.targetLabel ?? pair.target]));

  useEffect(() => {
    const controller = new AbortController();
    void requestJson<RequestOptions>('/requests/options', { signal: controller.signal })
      .then(setOptions)
      .catch(() => { if (!controller.signal.aborted) setOptions(null); });
    return () => controller.abort();
  }, [optionAttempt]);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    void requestJson<{ pairs: LanguagePair[] }>(`/requests/language-pairs?${query}`, { signal: controller.signal })
      .then(({ pairs }) => { if (!controller.signal.aborted) setAvailability({ key, pairs }); })
      .catch(() => { if (!controller.signal.aborted) setAvailability({ key, pairs: null }); });
    return () => controller.abort();
  }, [key, query]);

  useEffect(() => { if (error) errorSummary.current?.focus(); }, [error]);
  useEffect(() => { if (matchedCount !== null) confirmation.current?.focus(); }, [matchedCount]);

  function changeScope(next: Scope) {
    setScope(next);
    setAvailability(undefined);
    setSource('');
    setTarget('');
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !targets.has(target)) return;
    const formData = new FormData(event.currentTarget);
    const notes = String(formData.get('notes') ?? '').trim();
    setError(null);

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
          sourceLanguage: source,
          targetLanguage: target,
          domain: scope.domain,
          city: scope.onsite ? scope.city : undefined,
          onsiteRequired: scope.onsite,
          remoteAllowed: !scope.onsite,
          scheduledFor: new Date(String(formData.get('scheduledFor'))).toISOString(),
          notes: notes || undefined
        })
      });
      setMatchedCount(result.matchedCount);
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'PAIR_UNAVAILABLE') {
        setSource('');
        setTarget('');
        setPairAttempt((attempt) => attempt + 1);
        setError({ message: t('pairUnavailable') });
      } else {
        setError({ message: errorMessage(reason, t('broadcastError')) });
      }
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
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert" tabIndex={-1} ref={errorSummary}>
          {error.field ? <a className="block min-h-6 underline" href={`#${error.field}`}>{error.message}</a> : <p>{error.message}</p>}
        </div>
      )}
      {options === undefined && <p role="status">{t('loading')}</p>}
      {options === null && (
        <div className="space-y-2">
          <p role="alert">{t('optionsError')}</p>
          <Button type="button" onClick={() => { setOptions(undefined); setOptionAttempt((attempt) => attempt + 1); }}>{t('retry')}</Button>
        </div>
      )}
      {options && (
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="grid min-w-0 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="mode">{t('mode')}</Label>
              <Select id="mode" value={scope.onsite ? 'onsite' : 'remote'} onChange={(event) => changeScope({ ...scope, onsite: event.target.value === 'onsite', city: '' })}>
                <option value="remote">{t('remote')}</option>
                <option value="onsite">{t('onsite')}</option>
              </Select>
            </div>
            {scope.onsite && (
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="city">{t('city')}</Label>
                <Select id="city" name="city" value={scope.city} required onChange={(event) => changeScope({ ...scope, city: event.target.value })}>
                  <option value="" disabled>{t('choose')}</option>
                  {options.cities.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                </Select>
              </div>
            )}
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="domain">{t('domain')}</Label>
              <Select id="domain" name="domain" value={scope.domain} required onChange={(event) => changeScope({ ...scope, domain: event.target.value })}>
                <option value="" disabled>{t('choose')}</option>
                {options.domains.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </Select>
            </div>
            {query && pairs === undefined && <p className="text-sm text-quiet" role="status">{t('loadingPairs')}</p>}
            {query && pairs === null && (
              <div className="space-y-2">
                <p className="text-sm text-red-800" role="alert">{t('pairsError')}</p>
                <Button type="button" onClick={() => setPairAttempt((attempt) => attempt + 1)}>{t('retry')}</Button>
              </div>
            )}
            {pairs?.length === 0 && (
              <p className="rounded-md bg-mint p-3 text-sm text-forest" role="status">
                {t(scope.onsite ? 'noOnsitePairs' : 'noRemotePairs')}
              </p>
            )}
            {pairs && pairs.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="sourceLanguage">{t('sourceLanguage')}</Label>
                  <Select id="sourceLanguage" name="sourceLanguage" value={source} required onChange={(event) => { setSource(event.target.value); setTarget(''); }}>
                    <option value="" disabled>{t('choose')}</option>
                    {[...sources].sort((a, b) => a[1].localeCompare(b[1])).map(([name, label]) => <option key={name} value={name}>{label}</option>)}
                  </Select>
                </div>
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="targetLanguage">{t('targetLanguage')}</Label>
                  <Select id="targetLanguage" name="targetLanguage" value={target} required disabled={!source} onChange={(event) => setTarget(event.target.value)}>
                    <option value="" disabled>{t(source ? 'choose' : 'chooseSourceFirst')}</option>
                    {[...targets].sort((a, b) => a[1].localeCompare(b[1])).map(([name, label]) => <option key={name} value={name}>{label}</option>)}
                  </Select>
                </div>
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
            <Button type="submit" disabled={!target}>{t(busy ? 'sendingRequest' : 'broadcastAction')}</Button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
