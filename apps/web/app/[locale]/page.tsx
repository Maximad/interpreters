import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-slate-700">{t('subtitle')}</p>
    </section>
  );
}
