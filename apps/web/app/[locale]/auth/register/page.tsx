'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select } from '../../../../components/ui/select';
import { useToast } from '../../../../components/providers/toast-provider';
import { Link, useRouter } from '../../../../i18n/navigation';
import { ApiError, errorMessage, requestJson } from '../../../../lib/api';

const fields = [
  { name: 'fullName', type: 'text', autoComplete: 'name', minLength: 2 },
  { name: 'email', type: 'email', autoComplete: 'email' },
  { name: 'password', type: 'password', autoComplete: 'new-password', minLength: 8 }
] as const;

type Field = (typeof fields)[number]['name'];
type FormError = { message: string; field?: Field };

export default function RegisterPage() {
  const t = useTranslations('auth');
  const { showToast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);

  useEffect(() => { if (error) errorSummary.current?.focus(); }, [error]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const value = (name: string) => String(formData.get(name) ?? '');
    const payload = {
      fullName: value('fullName').trim(),
      email: value('email').trim(),
      password: value('password'),
      role: value('role') || 'CLIENT'
    };

    if (payload.fullName.length < 2) {
      setError({ field: 'fullName', message: t('nameRequired') });
      return;
    }
    const emailInput = form.elements.namedItem('email');
    if (!payload.email || (emailInput instanceof HTMLInputElement && emailInput.validity.typeMismatch)) {
      setError({ field: 'email', message: t('emailRequired') });
      return;
    }
    if (payload.password.length < 8) {
      setError({ field: 'password', message: t('passwordRule') });
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await requestJson('/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
      showToast({ title: t('successTitle'), description: t('registerSuccess') });
      router.push('/auth/verify-email');
    } catch (reason) {
      const status = reason instanceof ApiError ? reason.status : undefined;
      const fallback = status === 400 ? t('checkSignupFields') : t('registerError');
      setError({ message: errorMessage(reason, fallback) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">{t('register')}</h1>
      {error && (
        <div id="register-error" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"
          ref={errorSummary} role="alert" tabIndex={-1}>
          {error.field ? <a className="block min-h-6 underline" href={`#${error.field}`}>{error.message}</a> : <p>{error.message}</p>}
        </div>
      )}
      <form noValidate onSubmit={handleSubmit} aria-busy={busy} className="space-y-4">
        {fields.map(({ name, ...properties }) => {
          const description = [
            name === 'password' && 'register-password-rule',
            error?.field === name && 'register-error'
          ].filter(Boolean).join(' ');
          return (
            <div className="grid gap-1.5" key={name}>
              <Label htmlFor={name}>{t(name)}</Label>
              <Input id={name} name={name} {...properties} required
                aria-invalid={error?.field === name || undefined}
                aria-describedby={description || undefined} />
              {name === 'password' && <p className="text-sm text-quiet" id="register-password-rule">{t('passwordRule')}</p>}
            </div>
          );
        })}
        <div className="grid gap-1.5">
          <Label htmlFor="role">{t('role')}</Label>
          <Select id="role" name="role">
            <option value="CLIENT">{t('client')}</option>
            <option value="INTERPRETER">{t('interpreter')}</option>
          </Select>
        </div>
        <Button className="w-full" type="submit" disabled={busy}>{t(busy ? 'registering' : 'register')}</Button>
      </form>
      <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline underline-offset-4" href="/auth/verify-email">{t('verifyEmail')}</Link>
    </section>
  );
}
