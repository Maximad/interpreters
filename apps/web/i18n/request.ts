import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from './routing';

function deepMerge<T extends Record<string, any>>(base: T, custom: T): T {
  const output = { ...base } as Record<string, any>;
  Object.keys(custom || {}).forEach((key) => {
    if (
      typeof output[key] === 'object' &&
      output[key] !== null &&
      typeof custom[key] === 'object' &&
      !Array.isArray(custom[key])
    ) {
      output[key] = deepMerge(output[key], custom[key]);
    } else {
      output[key] = custom[key];
    }
  });
  return output as T;
}

export default getRequestConfig(async ({ locale }) => {
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const enMessages = (await import('../messages/en.json')).default;
  const localeMessages = locale === 'en'
    ? enMessages
    : (await import(`../messages/${locale}.json`)).default;

  return {
    messages: deepMerge(enMessages, localeMessages)
  };
});
