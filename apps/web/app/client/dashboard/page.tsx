'use client';

import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export default function ClientDashboardPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);

  async function load() {
    const token = localStorage.getItem('im_token');
    const [r1, r2, r3] = await Promise.all([
      fetch(`${apiBase}/dashboard/client/requests`, { headers: { authorization: `Bearer ${token}` } }),
      fetch(`${apiBase}/dashboard/client/inquiries`, { headers: { authorization: `Bearer ${token}` } }),
      fetch(`${apiBase}/dashboard/notifications`, { headers: { authorization: `Bearer ${token}` } })
    ]);

    setRequests(await r1.json());
    setInquiries(await r2.json());
    setNotes(await r3.json());
  }

  async function acceptQuote(requestId: string, quoteId: string) {
    const token = localStorage.getItem('im_token');
    await fetch(`${apiBase}/requests/${requestId}/quotes/${quoteId}/accept`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` }
    });
    await load();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Client dashboard</h1>
      <button className="rounded bg-slate-900 px-4 py-2 text-white" onClick={load} type="button">Load dashboard</button>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Broadcast requests & quotes</h2>
        {requests.map((item) => (
          <article className="rounded border bg-white p-4" key={item.id}>
            <p className="font-medium">{item.domain} • {item.city} • {item.status}</p>
            <p className="text-sm text-slate-600">Recipients: {item.recipients.length} | Quotes: {item.quotes.length}</p>
            <ul className="mt-2 space-y-2">
              {item.quotes.map((quote: any) => (
                <li className="rounded border p-2" key={quote.id}>
                  <p>{quote.amount_aed} AED — {quote.status}</p>
                  <button className="text-sm text-blue-700" onClick={() => acceptQuote(item.id, quote.id)} type="button">Accept quote</button>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Direct inquiries</h2>
        {inquiries.map((item) => (
          <article className="rounded border bg-white p-4" key={item.id}>
            <p className="font-medium">To: {item.interpreter_profile?.user?.full_name || 'Interpreter'} ({item.status})</p>
            <p className="text-sm text-slate-700">{item.message}</p>
          </article>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Notifications</h2>
        {notes.map((item) => (
          <article className="rounded border bg-white p-3" key={item.id}>
            <p className="text-sm"><strong>{item.category}</strong> via {item.channel}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
