'use client';

import { useTranslations } from 'next-intl';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../components/providers/toast-provider';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function VerifyEmailPage() {
  const t = useTranslations('auth');
  const { showToast } = useToast();

  async function handleSubmit(formData: FormData) {
    const token = String(formData.get('token') || '');
    const response = await fetch(`${apiBase}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await response.json();

    if (!response.ok) {
      showToast({ title: t('errorTitle'), description: data.message || t('verifyError'), tone: 'error' });
      return;
    }
    showToast({ title: t('successTitle'), description: t('verifySuccess') });
  }

  return (
    <section className="mx-auto max-w-md rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-semibold">{t('verifyEmail')}</h1>
      <form action={handleSubmit} className="space-y-4">
        <div><Label htmlFor="token">{t('verificationToken')}</Label><Input id="token" name="token" required /></div>
        <Button className="w-full" type="submit">{t('verifyEmail')}</Button>
      </form>
    </section>
  );
}
