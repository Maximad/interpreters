import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '../../i18n/navigation';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <div className="space-y-8 pb-8 lg:space-y-12 lg:pt-4">
      <section className="grid items-center gap-7 md:grid-cols-[1fr_1fr] md:gap-8 lg:gap-14">
        <div className="min-w-0 py-3 sm:py-6 lg:py-10">
          <p className="mb-4 text-sm font-semibold text-forest">{t('title')}</p>
          <h1 className="max-w-[13ch] text-balance text-[2.65rem] font-bold leading-[1.08] tracking-[-0.045em] [overflow-wrap:anywhere] sm:text-5xl lg:text-[4rem] rtl:tracking-normal">
            {t('headline')}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-quiet sm:text-lg">{t('subtitle')}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3 sm:gap-4">
            <Link href="/search" className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-forest px-5 text-sm font-semibold text-white transition hover:bg-ink min-[390px]:w-auto">
              {t('findInterpreters')} <span aria-hidden="true" className="rtl:rotate-180">→</span>
            </Link>
            <Link href="/client/broadcast" className="inline-flex min-h-12 items-center rounded-xl px-4 text-sm font-semibold text-forest underline decoration-forest/30 underline-offset-4 hover:bg-mint">
              {t('postRequest')}
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl bg-mint sm:rounded-[1.75rem]">
          <Image
            src="/images/interpreter-meeting.webp"
            alt={t('meetingImageAlt')}
            width={1280}
            height={960}
            unoptimized
            loading="eager"
            fetchPriority="high"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-mint px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight rtl:tracking-normal">{t('interpreterHeading')}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-quiet sm:text-base">{t('interpreterDescription')}</p>
        </div>
        <Link href="/auth/register" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-forest/25 bg-white px-4 text-sm font-semibold text-forest hover:bg-canvas">
          {t('join')}
        </Link>
      </section>
    </div>
  );
}
