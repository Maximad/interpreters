'use client';

import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function VerifyEmailPage() {
  const [message, setMessage] = useState('');

  async function handleSubmit(formData: FormData) {
    const token = String(formData.get('token') || '');
    const response = await fetch(`${apiBase}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await response.json();
    setMessage(data.message || 'Done');
  }

  return (
    <section className="mx-auto max-w-md rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-semibold">Verify email</h1>
      <form className="space-y-4" action={handleSubmit}>
        <input className="w-full rounded border p-2" name="token" placeholder="Verification token" required />
        <button className="w-full rounded bg-slate-900 p-2 text-white" type="submit">Verify</button>
      </form>
      {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
