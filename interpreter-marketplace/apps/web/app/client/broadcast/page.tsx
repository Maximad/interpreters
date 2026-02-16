'use client';

import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function BroadcastRequestPage() {
  const [message, setMessage] = useState('');

  async function submit(formData: FormData) {
    const token = localStorage.getItem('im_token');
    const payload = {
      sourceLanguage: String(formData.get('sourceLanguage') || ''),
      targetLanguage: String(formData.get('targetLanguage') || ''),
      domain: String(formData.get('domain') || ''),
      city: String(formData.get('city') || ''),
      onsiteRequired: Boolean(formData.get('onsiteRequired')),
      remoteAllowed: Boolean(formData.get('remoteAllowed')),
      scheduledFor: new Date(String(formData.get('scheduledFor') || new Date().toISOString())).toISOString(),
      budgetMinAed: Number(formData.get('budgetMinAed') || 0) || undefined,
      budgetMaxAed: Number(formData.get('budgetMaxAed') || 0) || undefined,
      minYears: Number(formData.get('minYears') || 0) || undefined,
      verifiedOnly: Boolean(formData.get('verifiedOnly')),
      notes: String(formData.get('notes') || '')
    };

    const response = await fetch(`${apiBase}/api/requests/broadcast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    setMessage(data.message || `Broadcast created. Matched interpreters: ${data.matchedCount || 0}`);
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">Broadcast request</h1>
      <form action={submit} className="grid gap-3">
        <input className="rounded border p-2" name="sourceLanguage" placeholder="Source language" required />
        <input className="rounded border p-2" name="targetLanguage" placeholder="Target language" required />
        <input className="rounded border p-2" name="domain" placeholder="Domain" required />
        <input className="rounded border p-2" name="city" placeholder="City" required />
        <input className="rounded border p-2" name="scheduledFor" type="datetime-local" required />
        <input className="rounded border p-2" name="budgetMinAed" placeholder="Min budget AED" />
        <input className="rounded border p-2" name="budgetMaxAed" placeholder="Max budget AED" />
        <input className="rounded border p-2" name="minYears" placeholder="Minimum years" />
        <label className="flex items-center gap-2"><input name="onsiteRequired" type="checkbox" /> Onsite required</label>
        <label className="flex items-center gap-2"><input defaultChecked name="remoteAllowed" type="checkbox" /> Remote allowed</label>
        <label className="flex items-center gap-2"><input name="verifiedOnly" type="checkbox" /> Verified interpreters only</label>
        <textarea className="rounded border p-2" name="notes" placeholder="Request details" required />
        <button className="rounded bg-slate-900 p-2 text-white" type="submit">Broadcast request</button>
      </form>
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
