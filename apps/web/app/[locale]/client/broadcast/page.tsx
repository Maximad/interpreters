'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
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
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson<ProfileOptions>('/profile/options')
      .then(setOptions)
      .catch((reason: unknown) => setError(errorMessage(reason, t('broadcastError'))));
  }, [t]);

  async function submit(formData: FormData) {
    const value = (key: string) => String(formData.get(key) ?? '');
    const onsite = value('mode') === 'onsite';
    setError('');
    setMatchedCount(null);
    setBusy(true);
    try {
      const body = {
        sourceLanguage: value('sourceLanguage'),
        targetLanguage: value('targetLanguage'),
        domain: value('domain'),
        city: value('city'),
        onsiteRequired: onsite,
        remoteAllowed: !onsite,
        scheduledFor: new Date(value('scheduledFor')).toISOString(),
        notes: value('notes').trim() || undefined
      };
      const result = await requestJson<{ matchedCount: number }>('/requests/broadcast', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify(body)
      });
      setMatchedCount(result.matchedCount);
    } catch (reason) {
      setError(errorMessage(reason, t('broadcastError')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5 rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">{t('broadcastTitle')}</h1>
      {options ? (
        <form action={submit} className="grid gap-3">
          {[{ field: 'sourceLanguage', items: options.languages }, { field: 'targetLanguage', items: options.languages },
            { field: 'domain', items: options.domains }, { field: 'city', items: options.cities }].map(({ field, items }) => (
            <div className="grid gap-2" key={field}>
              <Label htmlFor={field}>{t(field)}</Label>
              <Select id={field} name={field} defaultValue="" required>
                <option value="" disabled>{t('choose')}</option>
                {items.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </Select>
            </div>
          ))}
          <Label htmlFor="mode">{t('mode')}</Label>
          <Select id="mode" name="mode">
            <option value="remote">{t('remote')}</option>
            <option value="onsite">{t('onsite')}</option>
          </Select>
          <Label htmlFor="scheduledFor">{t('scheduledFor')}</Label>
          <Input id="scheduledFor" name="scheduledFor" type="datetime-local" required />
          <Label htmlFor="notes">{t('details')}</Label>
          <Textarea id="notes" name="notes" minLength={5} />
          <Button type="submit" disabled={busy}>{t('broadcastAction')}</Button>
        </form>
      ) : !error && <p>{t('loading')}</p>}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {matchedCount !== null && (
        <div className="space-y-2" role="status">
          <p>{matchedCount === 0 ? t('noMatches') : t('matchedCount', { count: matchedCount })}</p>
          <Link className="text-blue-700 underline" href="/client/dashboard">{t('clientDashboard')}</Link>
        </div>
      )}
    </section>
  );
}
