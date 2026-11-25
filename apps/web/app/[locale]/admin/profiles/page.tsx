'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { errorMessage, requestJson } from '../../../../lib/api';

type PendingProfile = {
  id: string;
  headline: string | null;
  languages: { direction: string }[];
  certifications: { id: string; name: string; file_url: string }[];
  user: { full_name: string };
};

export default function AdminProfilesPage() {
  const t = useTranslations('adminReview');
  const [profiles, setProfiles] = useState<PendingProfile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    requestJson<PendingProfile[]>('/admin/profiles/pending', { authenticated: true })
      .then(setProfiles)
      .catch((reason: unknown) => setError(errorMessage(reason, t('error'))));
  }, [t]);

  async function review(id: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string) {
    setBusy(true);
    setError('');
    try {
      await requestJson(`/admin/profiles/${id}/review`, {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ status, rejectionReason })
      });
      setProfiles((current) => current?.filter((item) => item.id !== id) ?? []);
    } catch (reason) {
      setError(errorMessage(reason, t('error')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {profiles === null && !error && <p>{t('loading')}</p>}
      {profiles?.length === 0 && <p>{t('empty')}</p>}
      {profiles?.map((profile) => (
        <article className="space-y-3 rounded-lg border bg-white p-5" key={profile.id}>
          <h2 className="font-semibold">{profile.user.full_name}</h2>
          {profile.headline && <p>{profile.headline}</p>}
          <ul className="list-inside list-disc">{profile.languages.map(({ direction }) => <li key={direction}>{direction}</li>)}</ul>
          <ul>
            {profile.certifications.map((certificate) => (
              <li key={certificate.id}>
                {/^https?:\/\//i.test(certificate.file_url) ? (
                  <a className="text-blue-700 underline" href={certificate.file_url} rel="noreferrer" target="_blank">{certificate.name}</a>
                ) : certificate.name}
              </li>
            ))}
          </ul>
          <Button type="button" disabled={busy} onClick={() => review(profile.id, 'APPROVED')}>{t('approve')}</Button>
          <form
            className="grid max-w-md gap-2 border-t pt-3"
            action={(formData) => review(profile.id, 'REJECTED', String(formData.get('reason') ?? '').trim())}
          >
            <Label htmlFor={`reason-${profile.id}`}>{t('reason')}</Label>
            <Textarea id={`reason-${profile.id}`} name="reason" minLength={5} required />
            <Button type="submit" disabled={busy}>{t('reject')}</Button>
          </form>
        </article>
      ))}
    </section>
  );
}
