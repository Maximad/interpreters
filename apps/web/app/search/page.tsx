'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

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
  const [results, setResults] = useState<SearchHit[]>([]);
  const [meta, setMeta] = useState({ page: 1, page_size: 10, total: 0 });
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    languages: '',
    domains: '',
    cities: '',
    onsite: false,
    remote: true,
    min_rate: '',
    max_rate: '',
    min_years: '',
    verified_only: false,
    page: 1
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.languages) params.set('languages', filters.languages);
    if (filters.domains) params.set('domains', filters.domains);
    if (filters.cities) params.set('cities', filters.cities);
    params.set('onsite', String(filters.onsite));
    params.set('remote', String(filters.remote));
    if (filters.min_rate) params.set('min_rate', filters.min_rate);
    if (filters.max_rate) params.set('max_rate', filters.max_rate);
    if (filters.min_years) params.set('min_years', filters.min_years);
    if (filters.verified_only) params.set('verified_only', 'true');
    params.set('page', String(filters.page));
    params.set('page_size', '10');
    return params.toString();
  }, [filters]);

  async function runSearch() {
    setLoading(true);
    const response = await fetch(`${apiBase}/search/interpreters?${queryString}`);
    const data = await response.json();
    setLoading(false);

    setResults(Array.isArray(data.hits) ? data.hits : []);
    setMeta({
      page: Number(data.page || 1),
      page_size: Number(data.page_size || 10),
      total: Number(data.total || 0)
    });
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Filters</h2>
        <div className="space-y-3 text-sm">
          <input className="w-full rounded border p-2" placeholder="Languages (comma separated)" value={filters.languages} onChange={(event) => setFilters((prev) => ({ ...prev, languages: event.target.value, page: 1 }))} />
          <input className="w-full rounded border p-2" placeholder="Domains (comma separated)" value={filters.domains} onChange={(event) => setFilters((prev) => ({ ...prev, domains: event.target.value, page: 1 }))} />
          <input className="w-full rounded border p-2" placeholder="Cities (comma separated)" value={filters.cities} onChange={(event) => setFilters((prev) => ({ ...prev, cities: event.target.value, page: 1 }))} />

          <label className="flex items-center gap-2"><input type="checkbox" checked={filters.onsite} onChange={(event) => setFilters((prev) => ({ ...prev, onsite: event.target.checked, page: 1 }))} /> Onsite</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={filters.remote} onChange={(event) => setFilters((prev) => ({ ...prev, remote: event.target.checked, page: 1 }))} /> Remote</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={filters.verified_only} onChange={(event) => setFilters((prev) => ({ ...prev, verified_only: event.target.checked, page: 1 }))} /> Verified only</label>

          <input className="w-full rounded border p-2" placeholder="Min rate" value={filters.min_rate} onChange={(event) => setFilters((prev) => ({ ...prev, min_rate: event.target.value, page: 1 }))} />
          <input className="w-full rounded border p-2" placeholder="Max rate" value={filters.max_rate} onChange={(event) => setFilters((prev) => ({ ...prev, max_rate: event.target.value, page: 1 }))} />
          <input className="w-full rounded border p-2" placeholder="Min years" value={filters.min_years} onChange={(event) => setFilters((prev) => ({ ...prev, min_years: event.target.value, page: 1 }))} />

          <button className="w-full rounded bg-slate-900 p-2 text-white" onClick={runSearch} type="button">Apply filters</button>
        </div>
      </aside>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Interpreters</h1>
          <p className="text-sm text-slate-600">{meta.total} results</p>
        </div>

        {loading ? <p>Loading...</p> : null}

        <ul className="space-y-3">
          {results.map((item) => (
            <li className="rounded-lg border bg-white p-4" key={item.id}>
              <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{item.full_name}</h3>
                  <p className="text-sm text-slate-600">{item.headline || 'Professional interpreter'}</p>
                </div>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs">{item.profile_completeness}% complete</span>
              </div>

              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p><strong>Languages:</strong> {item.languages.join(', ') || '—'}</p>
                <p><strong>Domains:</strong> {item.domains.join(', ') || '—'}</p>
                <p><strong>Cities:</strong> {item.cities.join(', ') || '—'}</p>
                <p><strong>Experience:</strong> {item.years_experience} years</p>
                <p><strong>Rate:</strong> {item.hourly_rate_aed ? `${item.hourly_rate_aed} AED/hr` : 'Not specified'}</p>
                <p><strong>Verified:</strong> {item.is_email_verified ? 'Yes' : 'No'}</p>
              </div>

              <Link className="mt-3 inline-block text-sm font-medium text-blue-700" href={`/search/${item.id}`}>View profile</Link>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <button
            className="rounded border px-3 py-1 disabled:opacity-50"
            disabled={filters.page <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
            type="button"
          >
            Prev
          </button>
          <button
            className="rounded border px-3 py-1"
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
            type="button"
          >
            Next
          </button>
          <button className="rounded bg-slate-900 px-3 py-1 text-white" onClick={runSearch} type="button">Load page</button>
        </div>
      </div>
    </section>
  );
}
