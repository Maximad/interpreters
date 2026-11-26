'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../components/providers/toast-provider';
import { Link, useRouter } from '../../../../i18n/navigation';
import { dashboardPath, setSessionToken } from '../../../../lib/auth-session';
import { errorMessage, requestJson } from '../../../../lib/api';

export default function LoginPage() {
  const t = useTranslations('auth');
  const [error, setError] = useState('');
  const { showToast } = useToast();
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const payload = {
      email: String(formData.get('email') || ''),
      password: String(formData.get('password') || '')
    };

    setError('');
    try {
      const data = await requestJson<{ token: string; user: { role: 'CLIENT' | 'INTERPRETER' | 'ADMIN' } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setSessionToken(data.token);
      showToast({ title: t('successTitle'), description: t('loginSuccess') });
      router.push(dashboardPath[data.user.role]);
    } catch (error) {
      const message = errorMessage(error, t('loginError'));
      setError(message);
      showToast({ title: t('errorTitle'), description: message, tone: 'error' });
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-semibold">{t('login')}</h1>
      <form action={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input aria-invalid={Boolean(error)} id="email" name="email" required type="email" />
        </div>
        <div>
          <Label htmlFor="password">{t('password')}</Label>
          <Input aria-invalid={Boolean(error)} id="password" name="password" required type="password" />
        </div>
        {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
        <Button className="w-full" type="submit">{t('login')}</Button>
      </form>
      <Link className="mt-4 inline-block text-sm text-blue-700" href="/auth/verify-email">{t('verifyEmail')}</Link>
    </section>
  );
}
