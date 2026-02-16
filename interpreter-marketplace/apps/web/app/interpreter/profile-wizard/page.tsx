'use client';

import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

type Step = 1 | 2 | 3 | 4 | 5;

export default function ProfileWizardPage() {
  const [step, setStep] = useState<Step>(1);
  const [message, setMessage] = useState('');

  async function callApi(path: string, payload: unknown) {
    const token = localStorage.getItem('im_token');
    const response = await fetch(`${apiBase}${path}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || 'Request failed');
      return;
    }
    setMessage(`Saved. Completeness: ${data.profile_completeness}% | Status: ${data.status}`);
    setStep((prev) => (prev < 5 ? ((prev + 1) as Step) : prev));
  }

  async function submitForReview() {
    const token = localStorage.getItem('im_token');
    const response = await fetch(`${apiBase}/api/profile/submit`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    setMessage(data.message || `Submitted with status ${data.status}`);
  }

  return (
    <section className="space-y-6 rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">Interpreter profile wizard</h1>
      <p className="text-sm text-slate-600">Step {step} of 5</p>

      {step === 1 ? (
        <form
          className="grid gap-3"
          action={(fd) =>
            callApi('/api/profile/wizard/step1', {
              fullName: String(fd.get('fullName') || ''),
              headline: String(fd.get('headline') || ''),
              cityId: Number(fd.get('cityId') || 1)
            })
          }
        >
          <input className="rounded border p-2" name="fullName" placeholder="Full name" required />
          <input className="rounded border p-2" name="headline" placeholder="Professional headline" required />
          <input className="rounded border p-2" name="cityId" placeholder="Primary city id" defaultValue="1" required />
          <button className="rounded bg-slate-900 p-2 text-white" type="submit">Save step 1</button>
        </form>
      ) : null}

      {step === 2 ? (
        <form
          className="grid gap-3"
          action={(fd) =>
            callApi('/api/profile/wizard/step2', {
              languages: [
                {
                  languageId: Number(fd.get('languageId') || 1),
                  direction: String(fd.get('direction') || 'Arabic->English'),
                  proficiencyLevel: String(fd.get('proficiencyLevel') || 'Professional')
                }
              ]
            })
          }
        >
          <input className="rounded border p-2" name="languageId" placeholder="Language id" defaultValue="1" required />
          <input className="rounded border p-2" name="direction" placeholder="Direction (e.g. Arabic->English)" required />
          <input className="rounded border p-2" name="proficiencyLevel" placeholder="Proficiency" defaultValue="Professional" />
          <button className="rounded bg-slate-900 p-2 text-white" type="submit">Save step 2</button>
        </form>
      ) : null}

      {step === 3 ? (
        <form
          className="grid gap-3"
          action={(fd) =>
            callApi('/api/profile/wizard/step3', {
              domainIds: String(fd.get('domainIds') || '1')
                .split(',')
                .map((value) => Number(value.trim())),
              onsiteEnabled: Boolean(fd.get('onsiteEnabled')),
              remoteEnabled: Boolean(fd.get('remoteEnabled')),
              coveredCityIds: String(fd.get('coveredCityIds') || '1')
                .split(',')
                .map((value) => Number(value.trim()))
            })
          }
        >
          <input className="rounded border p-2" name="domainIds" placeholder="Domain ids comma-separated" defaultValue="1" required />
          <label className="flex items-center gap-2"><input name="onsiteEnabled" type="checkbox" /> Onsite available</label>
          <label className="flex items-center gap-2"><input defaultChecked name="remoteEnabled" type="checkbox" /> Remote available</label>
          <input className="rounded border p-2" name="coveredCityIds" placeholder="Covered city ids comma-separated" defaultValue="1,2" required />
          <button className="rounded bg-slate-900 p-2 text-white" type="submit">Save step 3</button>
        </form>
      ) : null}

      {step === 4 ? (
        <form
          className="grid gap-3"
          action={(fd) =>
            callApi('/api/profile/wizard/step4', {
              hourlyRateAed: Number(fd.get('hourlyRateAed') || 250),
              yearsExperience: Number(fd.get('yearsExperience') || 5),
              availabilityNotes: String(fd.get('availabilityNotes') || '')
            })
          }
        >
          <input className="rounded border p-2" name="hourlyRateAed" placeholder="Hourly rate AED" defaultValue="250" required />
          <input className="rounded border p-2" name="yearsExperience" placeholder="Years experience" defaultValue="5" required />
          <textarea className="rounded border p-2" name="availabilityNotes" placeholder="Availability notes" required />
          <button className="rounded bg-slate-900 p-2 text-white" type="submit">Save step 4</button>
        </form>
      ) : null}

      {step === 5 ? (
        <form
          className="grid gap-3"
          action={(fd) =>
            callApi('/api/profile/wizard/step5', {
              certifications: [
                {
                  name: String(fd.get('name') || ''),
                  fileUrl: String(fd.get('fileUrl') || ''),
                  isPrivate: true
                }
              ]
            })
          }
        >
          <input className="rounded border p-2" name="name" placeholder="Certification name" required />
          <input className="rounded border p-2" name="fileUrl" placeholder="Certificate URL" required />
          <button className="rounded bg-slate-900 p-2 text-white" type="submit">Save step 5</button>
        </form>
      ) : null}

      <button className="rounded border border-slate-900 px-4 py-2" onClick={submitForReview} type="button">
        Submit for review
      </button>
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </section>
  );
}
