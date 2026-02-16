import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ar', 'hi', 'ur', 'ml', 'fil', 'fa', 'bn', 'ta'],
  defaultLocale: 'en'
});
