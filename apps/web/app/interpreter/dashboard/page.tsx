'use client';

import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export default function InterpreterDashboardPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [optOut, setOptOut] = useState(false);

  async function load() {
    const token = localStorage.getItem('im_token');
    const [r1, r2, r3] = await Promise.all([
      fetch(`${apiBase}/dashboard/interpreter/requests`, { headers: { authorization: `Bearer ${token}` } }),
      fetch(`${apiBase}/dashboard/interpreter/inquiries`, { headers: { authorization: `Bearer ${token}` } }),
      fetch(`${apiBase}/dashboard/notifications`, { headers: { authorization: `Bearer ${token}` } })
    ]);

    setRequests(await r1.json());
    setInquiries(await r2.json());
    setNotes(await r3.json());
  }

  async function submitQuote(requestId: string, amountAed: number) {
    const token = localStorage.getItem('im_token');
    await fetch(`${apiBase}/requests/${requestId}/quotes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ amountAed, message: 'Available and ready to support.' })
    });
    await load();
  }

  async function saveBroadcastPrefs() {
    const token = localStorage.getItem('im_token');
    await fetch(`${apiBase}/profile/broadcast-preferences`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ optOutBroadcastEmails: optOut })
    });
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Interpreter dashboard</h1>
      <div className="rounded border bg-white p-4">
        <label className="flex items-center gap-2"><input checked={optOut} onChange={(e) => setOptOut(e.target.checked)} type="checkbox" /> Opt out of broadcast emails</label>
        <button className="mt-2 rounded bg-slate-900 px-3 py-1 text-white" onClick={saveBroadcastPrefs} type="button">Save preference</button>
      </div>
      <button className="rounded bg-slate-900 px-4 py-2 text-white" onClick={load} type="button">Load dashboard</button>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Broadcast requests</h2>
        {requests.map((item) => (
          <article className="rounded border bg-white p-4" key={item.id}>
            <p className="font-medium">{item.request.domain} • {item.request.city}</p>
            <p className="text-sm text-slate-600">{item.request.notes || 'No notes'}</p>
            <button className="mt-2 text-sm text-blue-700" onClick={() => submitQuote(item.request.id, 300)} type="button">Submit sample quote (300 AED)</button>
          </article>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Direct inquiries</h2>
        {inquiries.map((item) => (
          <article className="rounded border bg-white p-4" key={item.id}>
            <p className="font-medium">From: {item.client.full_name} ({item.client.email})</p>
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
