import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '../../components/language-switcher';
import { Link } from '../../i18n/navigation';
import { ToastProvider } from '../../components/providers/toast-provider';
import { LocaleDocumentSync } from '../../components/providers/locale-document-sync';

function isRtl(locale: string) {
  return ['ar', 'fa'].includes(locale);
}

export default async function LocaleLayout({ children, params: { locale } }: { children: ReactNode; params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations('nav');
  const rtl = isRtl(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ToastProvider>
        <LocaleDocumentSync locale={locale} rtl={rtl} />
        <div className={`min-h-screen bg-slate-50 text-slate-900 ${rtl ? 'font-[Tahoma,Arial,sans-serif]' : 'font-[Inter,system-ui,sans-serif]'}`}>
          <header className="border-b bg-white">
            <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                <Link href="/">{t('home')}</Link>
                <Link href="/search">{t('search')}</Link>
                <Link href="/auth/login">{t('login')}</Link>
                <Link href="/auth/register">{t('register')}</Link>
                <Link href="/interpreter/profile-wizard">{t('profileWizard')}</Link>
                <Link href="/client/broadcast">{t('broadcast')}</Link>
              </div>
              <LanguageSwitcher />
            </nav>
          </header>
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        </div>
      </ToastProvider>
    </NextIntlClientProvider>
  );
}
