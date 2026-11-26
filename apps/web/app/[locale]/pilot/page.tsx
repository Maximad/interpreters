import { getTranslations } from 'next-intl/server';
import { pilotSupportEmail } from '../../../lib/pilot';

export default async function PilotPolicyPage() {
  const t = await getTranslations('pilot');
  const sections = ['payments', 'changes', 'disputes', 'privacy'] as const;

  return (
    <article className="mx-auto max-w-2xl space-y-5 rounded-xl border border-line bg-white p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">{t('policyTitle')}</h1>
      {sections.map((section) => (
        <section className="space-y-1" key={section}>
          <h2 className="font-semibold">{t(`policy.${section}.title`)}</h2>
          <p className="text-sm leading-relaxed">{t(`policy.${section}.body`)}</p>
        </section>
      ))}
      <a className="inline-flex min-h-11 max-w-full items-center break-all font-medium text-forest underline" href={`mailto:${pilotSupportEmail}`}>
        <bdi>{pilotSupportEmail}</bdi>
      </a>
    </article>
  );
}
