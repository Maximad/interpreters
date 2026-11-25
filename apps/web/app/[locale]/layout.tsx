import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SiteNav } from '../../components/site-nav';
import { ToastProvider } from '../../components/providers/toast-provider';
import { LocaleDocumentSync } from '../../components/providers/locale-document-sync';

export const dynamic = 'force-dynamic';

function isRtl(locale: string) {
  return ['ar', 'fa'].includes(locale);
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = await getMessages({ locale });
  const rtl = isRtl(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ToastProvider>
        <LocaleDocumentSync locale={locale} rtl={rtl} />
        <div dir={rtl ? 'rtl' : 'ltr'} className={`min-h-screen bg-canvas text-ink ${rtl ? 'font-[Tahoma,Arial,sans-serif]' : 'font-[Inter,system-ui,sans-serif]'}`}>
          <SiteNav />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        </div>
      </ToastProvider>
    </NextIntlClientProvider>
  );
}
