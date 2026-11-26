import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'ar', 'hi', 'ur', 'ml', 'fil', 'fa', 'bn', 'ta'] as const;

export const routing = defineRouting({
  locales,
  defaultLocale: 'en'
});
