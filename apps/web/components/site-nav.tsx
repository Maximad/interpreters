'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '../i18n/navigation';
import { dashboardPath, setSessionToken, useSession } from '../lib/auth-session';
import { LanguageSwitcher } from './language-switcher';

const search = { href: '/search', label: 'search' } as const;
const broadcast = { href: '/client/broadcast', label: 'broadcast' } as const;
const interpreterProfile = { href: '/interpreter/profile-wizard', label: 'myProfile' } as const;
const guest = [{ href: '/auth/login', label: 'login' }, { href: '/auth/register', label: 'register' }] as const;
type NavLink = { href: string; label: string };

export function SiteNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const links = [search, ...(!session || session.role === 'CLIENT' ? [broadcast] : [])];
  const accountLinks = session ? [
    { href: dashboardPath[session.role], label: 'dashboard' },
    ...(session.role === 'INTERPRETER' ? [interpreterProfile] : []),
    { href: '/account', label: 'accountSettings' }
  ] : session === null ? guest : [];

  function menuLink({ href, label }: NavLink) {
    return (
      <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}
        className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold hover:bg-mint aria-[current=page]:bg-mint"
        onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}>
        {t(label)}
      </Link>
    );
  }

  return (
    <header className="border-b border-line bg-canvas">
      <nav aria-label={t('mainNavigation')} className="mx-auto flex min-h-[4.5rem] max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" aria-label={t('brand')} className="inline-flex min-h-11 items-center gap-2 text-xl font-bold tracking-tight text-forest rtl:tracking-normal">
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-lg text-white">ن</span>
          <span className="sm:hidden">{t('shortBrand')}</span>
          <span className="hidden sm:inline">{t('brand')}</span>
        </Link>
        <div className="hidden items-center gap-2 lg:flex">
          {[...links, ...(session === null ? guest : [])].map(menuLink)}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <details key={pathname} className={`relative ${session ? '' : 'lg:hidden'}`}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-line bg-white px-3 text-sm font-semibold hover:bg-mint [&::-webkit-details-marker]:hidden">
              {t(session ? 'account' : 'menu')}
            </summary>
            <div className="absolute end-0 top-full z-20 mt-2 grid w-56 rounded-xl border border-line bg-white p-2 shadow-lg">
              <div className="grid lg:hidden">{links.map(menuLink)}</div>
              {accountLinks.map(menuLink)}
              {session && (
                <button className="min-h-11 rounded-lg px-3 text-start text-sm font-semibold hover:bg-mint" type="button"
                  onClick={() => { setSessionToken(null); router.replace('/'); }}>
                  {t('logout')}
                </button>
              )}
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
