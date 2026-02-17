'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../components/providers/toast-provider';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export default function LoginPage() {
  const t = useTranslations('auth');
  const [error, setError] = useState('');
  const { showToast } = useToast();

  async function handleSubmit(formData: FormData) {
    const payload = {
      email: String(formData.get('email') || ''),
      password: String(formData.get('password') || '')
    };

    setError('');
    const response = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data.message || t('loginError');
      setError(message);
      showToast({ title: t('errorTitle'), description: message, tone: 'error' });
      return;
    }

    localStorage.setItem('im_token', data.token);
    showToast({ title: t('successTitle'), description: t('loginSuccess') });
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
    </section>
  );
}
