'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Link } from '../../../i18n/navigation';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

type SearchHit = {
  id: string;
  full_name: string;
  headline: string | null;
  languages: string[];
  domains: string[];
  cities: string[];
  hourly_rate_aed: number | null;
  years_experience: number;
  is_email_verified: boolean;
  profile_completeness: number;
};

export default function SearchPage() {
  const t = useTranslations('search');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [filters, setFilters] = useState({ languages: '', domains: '', cities: '', page: 1 });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.languages) params.set('languages', filters.languages);
    if (filters.domains) params.set('domains', filters.domains);
    if (filters.cities) params.set('cities', filters.cities);
    params.set('page', String(filters.page));
    params.set('page_size', '10');
    return params.toString();
  }, [filters]);

  async function runSearch() {
    const response = await fetch(`${apiBase}/api/search/interpreters?${queryString}`);
    const data = await response.json();
    setResults(Array.isArray(data.hits) ? data.hits : []);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">{t('filters')}</h2>
        <div className="space-y-3 text-sm">
          <div><label className="mb-1 block text-sm font-medium">{t('languages')}</label><Input value={filters.languages} onChange={(e) => setFilters((p) => ({ ...p, languages: e.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium">{t('domains')}</label><Input value={filters.domains} onChange={(e) => setFilters((p) => ({ ...p, domains: e.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium">{t('cities')}</label><Input value={filters.cities} onChange={(e) => setFilters((p) => ({ ...p, cities: e.target.value }))} /></div>
          <Button className="w-full" onClick={runSearch} type="button">{t('applyFilters')}</Button>
        </div>
      </aside>

      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <ul className="space-y-3">
          {results.map((item) => (
            <li className="rounded-lg border bg-white p-4" key={item.id}>
              <h3 className="text-lg font-semibold">{item.full_name}</h3>
              <p className="text-sm text-slate-600">{item.headline || t('fallbackHeadline')}</p>
              <p className="text-sm">{t('rate')}: {item.hourly_rate_aed ? `${item.hourly_rate_aed} AED/hr` : t('notSpecified')}</p>
              <Link className="mt-3 inline-block text-sm font-medium text-blue-700" href={`/search/${item.id}`}>{t('viewProfile')}</Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
