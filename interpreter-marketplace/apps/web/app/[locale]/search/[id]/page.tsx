'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '../../../../i18n/navigation';
import { Button } from '../../../../components/ui/button';
import { Textarea } from '../../../../components/ui/textarea';
import { useToast } from '../../../../components/providers/toast-provider';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function InterpreterProfileDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('requestFlow');
  const { showToast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState('');

  useEffect(() => {
    fetch(`${apiBase}/api/search/interpreters/${params.id}`).then((r) => r.ok ? r.json() : null).then(setProfile);
  }, [params.id]);

  async function requestQuote() {
    const token = localStorage.getItem('im_token');
    const response = await fetch(`${apiBase}/api/direct-inquiries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ interpreterProfileId: params.id, message, details })
    });
    const data = await response.json();
    if (!response.ok) {
      showToast({ title: t('errorTitle'), description: data.message || t('inquiryError'), tone: 'error' });
      return;
    }
    showToast({ title: t('successTitle'), description: t('inquirySent') });
  }

  if (!profile) return <p>{t('loading')}</p>;

  return (
    <section className="space-y-4 rounded-lg border bg-white p-6">
      <Link className="text-sm text-blue-700" href="/search">{t('backToSearch')}</Link>
      <h1 className="text-3xl font-bold">{profile.full_name}</h1>
      <p>{profile.headline}</p>
      <div>
        <h2 className="text-lg font-semibold">{t('requestQuote')}</h2>
        <Textarea onChange={(e) => setMessage(e.target.value)} placeholder={t('message')} value={message} />
        <Textarea className="mt-2" onChange={(e) => setDetails(e.target.value)} placeholder={t('details')} value={details} />
        <Button className="mt-3" onClick={requestQuote} type="button">{t('sendInquiry')}</Button>
      </div>
    </section>
  );
}
