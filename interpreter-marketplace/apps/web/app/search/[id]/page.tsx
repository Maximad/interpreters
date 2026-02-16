'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function InterpreterProfileDetailPage({ params }: { params: { id: string } }) {
  const [profile, setProfile] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch(`${apiBase}/api/search/interpreters/${params.id}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setProfile(data));
  }, [params.id]);

  async function requestQuote() {
    const token = localStorage.getItem('im_token');
    const response = await fetch(`${apiBase}/api/direct-inquiries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ interpreterProfileId: params.id, message, details })
    });
    const data = await response.json();
    setNotice(data.message || 'Direct inquiry sent. Interpreter has been notified.');
  }

  if (!profile) {
    return (
      <section className="space-y-4">
        <p>Profile not found.</p>
        <Link className="text-blue-700" href="/search">Back to search</Link>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border bg-white p-6">
      <Link className="text-sm text-blue-700" href="/search">← Back to search</Link>
      <h1 className="text-3xl font-bold">{profile.full_name}</h1>
      <p className="text-slate-700">{profile.headline || 'Professional interpreter'}</p>
      <p className="text-slate-700">{profile.bio || 'No bio provided.'}</p>

      <div className="grid gap-3 text-sm md:grid-cols-2">
        <p><strong>Languages:</strong> {(profile.languages || []).join(', ') || '—'}</p>
        <p><strong>Domains:</strong> {(profile.domains || []).join(', ') || '—'}</p>
        <p><strong>Cities:</strong> {(profile.cities || []).join(', ') || '—'}</p>
        <p><strong>Experience:</strong> {profile.years_experience} years</p>
        <p><strong>Rate:</strong> {profile.hourly_rate_aed ? `${profile.hourly_rate_aed} AED/hr` : 'Not specified'}</p>
        <p><strong>Verified:</strong> {profile.is_email_verified ? 'Yes' : 'No'}</p>
      </div>

      <div className="rounded border p-4">
        <h2 className="text-lg font-semibold">Request quote</h2>
        <textarea className="mt-2 w-full rounded border p-2" onChange={(e) => setMessage(e.target.value)} placeholder="Your message" value={message} />
        <textarea className="mt-2 w-full rounded border p-2" onChange={(e) => setDetails(e.target.value)} placeholder="Additional details" value={details} />
        <button className="mt-2 rounded bg-slate-900 px-3 py-1 text-white" onClick={requestQuote} type="button">Send inquiry</button>
        {notice ? <p className="mt-2 text-sm text-slate-700">{notice}</p> : null}
      </div>
    </section>
  );
}
