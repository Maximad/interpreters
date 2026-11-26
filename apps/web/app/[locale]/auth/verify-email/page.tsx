'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../components/providers/toast-provider';
import { useRouter } from '../../../../i18n/navigation';
import { errorMessage, requestJson } from '../../../../lib/api';

export default function VerifyEmailPage() {
  const t = useTranslations('auth');
  const { showToast } = useToast();
  const router = useRouter();
  const tokenInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const token = fragment.get('token');
    if (token && tokenInput.current) tokenInput.current.value = token;
  }, []);

  async function handleSubmit(formData: FormData) {
    const token = String(formData.get('token') || '');
    try {
      await requestJson('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
      showToast({ title: t('successTitle'), description: t('verifySuccess') });
      router.replace('/auth/login');
    } catch (error) {
      showToast({ title: t('errorTitle'), description: errorMessage(error, t('verifyError')), tone: 'error' });
    }
  }

  async function resend(formData: FormData) {
    const email = String(formData.get('email') || '');
    try {
      await requestJson('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
      showToast({ title: t('successTitle'), description: t('resendSuccess') });
    } catch (error) {
      showToast({ title: t('errorTitle'), description: errorMessage(error, t('resendError')), tone: 'error' });
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-semibold">{t('verifyEmail')}</h1>
      <form action={handleSubmit} className="space-y-4">
        <div><Label htmlFor="token">{t('verificationToken')}</Label><Input id="token" name="token" ref={tokenInput} required /></div>
        <Button className="w-full" type="submit">{t('verifyEmail')}</Button>
      </form>
      <form action={resend} className="mt-6 space-y-4 border-t pt-6">
        <div><Label htmlFor="resend-email">{t('email')}</Label><Input id="resend-email" name="email" required type="email" /></div>
        <Button className="w-full" type="submit">{t('resendVerification')}</Button>
      </form>
    </section>
  );
}
