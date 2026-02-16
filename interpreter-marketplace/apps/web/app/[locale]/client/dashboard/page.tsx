'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '../../../../components/ui/button';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function ClientDashboardPage() {
  const t = useTranslations('requestFlow');
  const [requests, setRequests] = useState<any[]>([]);

  async function load() {
    const token = localStorage.getItem('im_token');
    const response = await fetch(`${apiBase}/api/dashboard/client/requests`, { headers: { authorization: `Bearer ${token}` } });
    setRequests(await response.json());
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('clientDashboard')}</h1>
      <Button onClick={load} type="button">{t('loadDashboard')}</Button>
      {requests.map((item) => <article className="rounded border bg-white p-4" key={item.id}>{item.domain} • {item.status}</article>)}
    </section>
  );
}
