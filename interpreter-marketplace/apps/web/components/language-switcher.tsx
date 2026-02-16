'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '../i18n/navigation';
import { Button } from './ui/button';

const localeLabels: Record<string, string> = {
  en: 'English', ar: 'العربية', hi: 'हिन्दी', ur: 'اردو', ml: 'മലയാളം', fil: 'Filipino', fa: 'فارسی', bn: 'বাংলা', ta: 'தமிழ்'
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function changeLocale(nextLocale: string) {
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button className="bg-transparent text-slate-900 hover:bg-slate-100">{localeLabels[locale] || 'Language'}</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-48 rounded-md border bg-white p-1 shadow-md" align="end">
          {Object.entries(localeLabels).map(([key, label]) => (
            <DropdownMenu.Item
              className="cursor-pointer rounded px-2 py-2 text-sm outline-none hover:bg-slate-100"
              key={key}
              onSelect={() => changeLocale(key)}
            >
              {label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
