'use client';

import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export default function RegisterPage() {
  const [message, setMessage] = useState('');

  async function handleSubmit(formData: FormData) {
    const payload = {
      fullName: String(formData.get('fullName') || ''),
      email: String(formData.get('email') || ''),
      password: String(formData.get('password') || ''),
      role: String(formData.get('role') || 'CLIENT')
    };

    const response = await fetch(`${apiBase}/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || 'Registration failed');
      return;
    }

    setMessage(data.message || 'Account created. Please check your email to verify your account.');
  }

  return (
    <section className="mx-auto max-w-md rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-semibold">Create account</h1>
      <form className="space-y-4" action={handleSubmit}>
        <input className="w-full rounded border p-2" name="fullName" placeholder="Full name" required />
        <input className="w-full rounded border p-2" name="email" placeholder="Email" type="email" required />
        <input className="w-full rounded border p-2" name="password" placeholder="Password" type="password" required />
        <select className="w-full rounded border p-2" name="role" defaultValue="CLIENT">
          <option value="CLIENT">Client</option>
          <option value="INTERPRETER">Interpreter</option>
        </select>
        <button className="w-full rounded bg-slate-900 p-2 text-white" type="submit">Register</button>
      </form>
      {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
