import { getRequestConfig } from 'next-intl/server';
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
  const resolvedLocale = routing.locales.includes(locale as any) ? locale : routing.defaultLocale;

  const enMessages = (await import('../messages/en.json')).default;
  const localeMessages = resolvedLocale === 'en'
    ? enMessages
    : (await import(`../messages/${resolvedLocale}.json`)).default;

  return {
    locale: resolvedLocale,
    messages: deepMerge(enMessages, localeMessages)
  };
});
