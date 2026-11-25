'use client';

import { useTranslations } from 'next-intl';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../components/providers/toast-provider';
import { Link, useRouter } from '../../../../i18n/navigation';
import { errorMessage, requestJson } from '../../../../lib/api';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const { showToast } = useToast();
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    const payload = {
      fullName: String(formData.get('fullName') || ''),
      email: String(formData.get('email') || ''),
      password: String(formData.get('password') || ''),
      role: String(formData.get('role') || 'CLIENT')
    };

    try {
      await requestJson('/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
      showToast({ title: t('successTitle'), description: t('registerSuccess') });
      router.push('/auth/verify-email');
    } catch (error) {
      showToast({ title: t('errorTitle'), description: errorMessage(error, t('registerError')), tone: 'error' });
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-semibold">{t('register')}</h1>
      <form action={handleSubmit} className="space-y-4">
        <div><Label htmlFor="fullName">{t('fullName')}</Label><Input id="fullName" name="fullName" required /></div>
        <div><Label htmlFor="email">{t('email')}</Label><Input id="email" name="email" required type="email" /></div>
        <div><Label htmlFor="password">{t('password')}</Label><Input id="password" name="password" required type="password" /></div>
        <div>
          <Label htmlFor="role">{t('role')}</Label>
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" id="role" name="role">
            <option value="CLIENT">{t('client')}</option>
            <option value="INTERPRETER">{t('interpreter')}</option>
          </select>
        </div>
        <Button className="w-full" type="submit">{t('register')}</Button>
      </form>
      <Link className="mt-4 inline-block text-sm text-blue-700" href="/auth/verify-email">{t('verifyEmail')}</Link>
    </section>
  );
}
