import { useTranslations } from 'next-intl';
import { Link } from '../i18n/navigation';

export type ProfileReview = {
  id: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason: string | null;
};

export function InterpreterProfileStatus({ profile, inWizard = false }: {
  profile: ProfileReview | null;
  inWizard?: boolean;
}) {
  const t = useTranslations('profileWizard');
  const nav = useTranslations('nav');
  const status = profile?.status ?? 'DRAFT';
  const href = inWizard ? '/interpreter/dashboard' : status === 'APPROVED' ? `/search/${profile?.id}` : '/interpreter/profile-wizard';
  const label = inWizard ? nav('dashboard') : t(status === 'APPROVED' ? 'viewPublicProfile' : 'manageProfile');

  return (
    <section className="space-y-2 rounded-xl border border-line bg-mint p-4 sm:p-5">
      <div role="status">
        <h2 className="text-lg font-semibold">{t(`next.${status}.heading`)}</h2>
        <p className="mt-1 text-sm text-quiet">{t(`next.${status}.description`)}</p>
        {status === 'REJECTED' && profile?.rejection_reason && <p className="mt-2 text-sm" dir="auto">{profile.rejection_reason}</p>}
      </div>
      <Link href={href} className="inline-flex min-h-11 items-center font-semibold text-forest underline underline-offset-4">{label}</Link>
    </section>
  );
}
