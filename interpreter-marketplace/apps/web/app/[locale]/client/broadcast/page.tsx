'use client';

import { useTranslations } from 'next-intl';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { useToast } from '../../../../components/providers/toast-provider';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function BroadcastRequestPage() {
  const t = useTranslations('requestFlow');
  const { showToast } = useToast();

  async function submit(formData: FormData) {
    const token = localStorage.getItem('im_token');
    const payload = {
      sourceLanguage: String(formData.get('sourceLanguage') || ''),
      targetLanguage: String(formData.get('targetLanguage') || ''),
      domain: String(formData.get('domain') || ''),
      city: String(formData.get('city') || ''),
      onsiteRequired: Boolean(formData.get('onsiteRequired')),
      remoteAllowed: Boolean(formData.get('remoteAllowed')),
      scheduledFor: new Date(String(formData.get('scheduledFor') || new Date().toISOString())).toISOString(),
      notes: String(formData.get('notes') || '')
    };

    const response = await fetch(`${apiBase}/api/requests/broadcast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return showToast({ title: t('errorTitle'), description: t('broadcastError'), tone: 'error' });
    showToast({ title: t('successTitle'), description: t('broadcastSuccess') });
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">{t('broadcastTitle')}</h1>
      <form action={submit} className="grid gap-3">
        <Input name="sourceLanguage" placeholder={t('sourceLanguage')} required />
        <Input name="targetLanguage" placeholder={t('targetLanguage')} required />
        <Input name="domain" placeholder={t('domain')} required />
        <Input name="city" placeholder={t('city')} required />
        <Input name="scheduledFor" type="datetime-local" required />
        <label><input name="onsiteRequired" type="checkbox" /> {t('onsite')}</label>
        <label><input defaultChecked name="remoteAllowed" type="checkbox" /> {t('remote')}</label>
        <Textarea name="notes" placeholder={t('details')} required />
        <Button type="submit">{t('broadcastAction')}</Button>
      </form>
    </section>
  );
}
