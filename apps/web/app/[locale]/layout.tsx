import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SiteNav } from '../../components/site-nav';
import { ToastProvider } from '../../components/providers/toast-provider';
import { LocaleDocumentSync } from '../../components/providers/locale-document-sync';
import { Link } from '../../i18n/navigation';
import { pilotSupportEmail } from '../../lib/pilot';

export const dynamic = 'force-dynamic';

function isRtl(locale: string) {
  return ['ar', 'fa'].includes(locale);
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [messages, t] = await Promise.all([getMessages({ locale }), getTranslations({ locale, namespace: 'pilot' })]);
  const rtl = isRtl(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ToastProvider>
        <LocaleDocumentSync locale={locale} rtl={rtl} />
        <div dir={rtl ? 'rtl' : 'ltr'} className={`flex min-h-screen flex-col bg-canvas text-ink ${rtl ? 'font-[Tahoma,Arial,sans-serif]' : 'font-[Inter,system-ui,sans-serif]'}`}>
          <SiteNav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <footer className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-5 border-t border-line px-4 text-sm">
            <Link className="inline-flex min-h-11 items-center text-forest underline" href="/pilot">{t('policyTitle')}</Link>
            <a className="inline-flex min-h-11 items-center text-forest underline" href={`mailto:${pilotSupportEmail}`}>{t('contactSupport')}</a>
          </footer>
        </div>
      </ToastProvider>
    </NextIntlClientProvider>
  );
}
