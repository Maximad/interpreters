'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { findLanguage, LanguagePicker } from '../../../components/language-picker';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { Link } from '../../../i18n/navigation';
import { requestJson, type ProfileOptions } from '../../../lib/api';

const filterFields = ['languages', 'domains', 'cities'] as const;
type FilterField = (typeof filterFields)[number];
type Filters = Record<FilterField, string>;
type SearchQuery = { filters: Filters; page: number };
const emptyFilters: Filters = { languages: '', domains: '', cities: '' };
const pageSize = 10;

type SearchHit = {
  id: string;
  full_name: string;
  headline: string | null;
  languages: string[];
  domains: string[];
  cities: string[];
  hourly_rate_aed: number | null;
};

type SearchResponse = { hits: SearchHit[]; total: number };

export default function SearchPage() {
  const t = useTranslations('search');
  const home = useTranslations('home');
  const locale = useLocale();
  const [lookups, setLookups] = useState<{ attempt: number; values: ProfileOptions | null }>();
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [draft, setDraft] = useState(emptyFilters);
  const [query, setQuery] = useState<SearchQuery>({ filters: emptyFilters, page: 1 });
  const [search, setSearch] = useState<{ query: SearchQuery; result: SearchResponse | null }>();
  const current = search?.query === query ? search : undefined;
  const options = lookups?.attempt === lookupAttempt ? lookups.values : undefined;
  const hasFilters = filterFields.some((field) => query.filters[field]);
  const price = new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED' });

  useEffect(() => {
    const controller = new AbortController();
    requestJson<ProfileOptions>('/profile/options', { signal: controller.signal })
      .then((values) => setLookups({ attempt: lookupAttempt, values }))
      .catch(() => {
        if (!controller.signal.aborted) setLookups({ attempt: lookupAttempt, values: null });
      });
    return () => controller.abort();
  }, [lookupAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(query.page), page_size: String(pageSize) });
    for (const field of filterFields) {
      if (query.filters[field]) params.set(field === 'languages' ? 'language' : field, query.filters[field]);
    }
    requestJson<SearchResponse>(`/search/interpreters?${params}`, { signal: controller.signal })
      .then((result) => setSearch({ query, result }))
      .catch(() => {
        if (!controller.signal.aborted) setSearch({ query, result: null });
      });
    return () => controller.abort();
  }, [query]);

  function clearFilters() {
    setDraft(emptyFilters);
    setQuery({ filters: emptyFilters, page: 1 });
  }

  return (
    <section className="space-y-6 pb-8 lg:pt-3">
      <header>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl rtl:tracking-normal">{t('title')}</h1>
        <p className="mt-3 max-w-xl text-quiet">{t('description')}</p>
      </header>

      <form className="grid gap-4 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const language = findLanguage(options?.directoryLanguages ?? [], draft.languages);
          setQuery({ filters: { ...draft, languages: language?.name ?? '' }, page: 1 });
        }}>
        {filterFields.map((field) => (
          <div className="grid min-w-0 gap-2" key={field}>
            <Label htmlFor={`search-${field}`}>{t(field)}</Label>
            {field === 'languages' ? (
              <LanguagePicker id="search-languages" languages={options?.directoryLanguages ?? []} value={draft.languages}
                onChange={(languages) => setDraft({ ...draft, languages })} placeholder={t('any.languages')} disabled={!options} />
            ) : (
              <Select
                id={`search-${field}`}
                className="border-quiet/70"
                value={draft[field]}
                disabled={!options}
                onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
              >
                <option value="">{t(`any.${field}`)}</option>
                {options?.[field].map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </Select>
            )}
          </div>
        ))}
        <Button type="submit" disabled={!options} className="w-full rounded-lg px-6">{t('applyFilters')}</Button>
        {options === undefined && <p className="text-sm text-quiet sm:col-span-full" role="status">{t('loadingOptions')}</p>}
        {options === null && (
          <div className="flex flex-wrap items-center gap-3 sm:col-span-full">
            <p className="text-sm text-red-800" role="alert">{t('optionsError')}</p>
            <Button type="button" className="border border-line bg-white text-forest hover:bg-mint" onClick={() => setLookupAttempt(lookupAttempt + 1)}>{t('retry')}</Button>
          </div>
        )}
      </form>

      {!current && <p className="text-sm text-quiet" role="status">{t('loadingResults')}</p>}
      {current?.result === null && (
        <div className="rounded-2xl border border-line bg-white p-5">
          <p role="alert">{t('searchError')}</p>
          <Button type="button" className="mt-3" onClick={() => setQuery({ ...query })}>{t('retry')}</Button>
        </div>
      )}
      {current?.result && (
        <div className="space-y-4">
          {current.result.hits.length === 0 ? (
            <div className="rounded-2xl border border-line bg-mint p-5 sm:p-7">
              <div role="status">
                <h2 className="text-xl font-semibold">{t(hasFilters ? 'noMatches' : 'noProfiles')}</h2>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-quiet">{t(hasFilters ? 'filterSuggestion' : 'requestSuggestion')}</p>
              </div>
              {hasFilters ? (
                <Button type="button" className="mt-4" onClick={clearFilters}>{t('clearFilters')}</Button>
              ) : (
                <Link className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-forest px-4 text-sm font-semibold text-white hover:bg-ink" href="/client/broadcast">
                  {home('postRequest')}
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold" role="status">{t('profileCount', { count: current.result.total })}</h2>
                {hasFilters && <Button type="button" className="border border-line bg-white text-forest hover:bg-mint" onClick={clearFilters}>{t('clearFilters')}</Button>}
              </div>
              <ul className="grid gap-4 md:grid-cols-2">
                {current.result.hits.map((item) => (
                  <li className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-white p-5" key={item.id}>
                    <div className="min-w-0">
                      <h3 className="break-words text-xl font-semibold" dir="auto">{item.full_name}</h3>
                      <p className="mt-1 break-words text-sm text-quiet" dir="auto">{item.headline || t('fallbackHeadline')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[...new Set([...item.languages, ...item.cities])].slice(0, 6).map((label) => (
                        <span className="max-w-full break-words rounded-full bg-mint px-3 py-1 text-sm text-forest" key={label} dir="auto">{label}</span>
                      ))}
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <p className="text-sm font-medium text-quiet">
                        {item.hourly_rate_aed !== null
                          ? t('ratePerHour', { price: price.format(item.hourly_rate_aed) })
                          : t('rateOnRequest')}
                      </p>
                      <Link className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-forest underline underline-offset-4 hover:bg-mint" href={`/search/${item.id}`}>
                        {t('viewProfile')}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(query.page > 1 || current.result.total > query.page * pageSize) && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={query.page === 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}>{t('previousPage')}</Button>
              <Button type="button" disabled={current.result.total <= query.page * pageSize} onClick={() => setQuery({ ...query, page: query.page + 1 })}>{t('nextPage')}</Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
