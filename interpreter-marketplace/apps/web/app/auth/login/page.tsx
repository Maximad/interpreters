'use client';

import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function LoginPage() {
  const [message, setMessage] = useState('');

  async function handleSubmit(formData: FormData) {
    const payload = {
      email: String(formData.get('email') || ''),
      password: String(formData.get('password') || '')
    };

    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || 'Login failed');
      return;
    }

    localStorage.setItem('im_token', data.token);
    setMessage(`Logged in as ${data.user.role}. Token stored in localStorage.`);
  }

  return (
    <section className="mx-auto max-w-md rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-semibold">Login</h1>
      <form className="space-y-4" action={handleSubmit}>
        <input className="w-full rounded border p-2" name="email" placeholder="Email" type="email" required />
        <input className="w-full rounded border p-2" name="password" placeholder="Password" type="password" required />
        <button className="w-full rounded bg-slate-900 p-2 text-white" type="submit">Sign in</button>
      </form>
      {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
