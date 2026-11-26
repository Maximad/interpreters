'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import { InterpreterProfileStatus, type ProfileReview } from '../../../../components/interpreter-profile-status';
import { LanguagePicker } from '../../../../components/language-picker';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select } from '../../../../components/ui/select';
import { Textarea } from '../../../../components/ui/textarea';
import { Link } from '../../../../i18n/navigation';
import { ApiError, errorMessage, requestJson, type Lookup, type ProfileOptions } from '../../../../lib/api';

type Profile = ProfileReview & {
  headline: string | null;
  bio: string | null;
  user: { full_name: string };
  savedLanguageOptions: Lookup[];
  languages: { direction: string; proficiency_level: string | null }[];
  domains: { domain_id: number }[];
  cities: { city_id: number }[];
  certifications: { name: string; file_url: string; is_private: boolean }[];
  onsite_enabled: boolean;
  remote_enabled: boolean;
  hourly_rate_aed: string | null;
  years_experience: number;
  availability_notes: string | null;
  profile_completeness: number;
};

export default function ProfileWizardPage() {
  const t = useTranslations('profileWizard');
  const languagePicker = useTranslations('languagePicker');
  const auth = useTranslations('auth');
  const [step, setStep] = useState(1);
  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [languageRows, setLanguageRows] = useState(1);
  const [certificateRows, setCertificateRows] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingPending, setEditingPending] = useState(false);

  useEffect(() => {
    const settings = { authenticated: true };
    const existing = requestJson<Profile>('/profile/me', settings).catch((reason: unknown) => {
      if (reason instanceof ApiError && reason.status === 404) return null;
      throw reason;
    });
    Promise.all([requestJson<ProfileOptions>('/profile/options'), existing])
      .then(([lookups, saved]) => {
        setOptions(lookups);
        setProfile(saved);
        setLanguageRows(Math.max(1, saved?.languages.length ?? 0));
        setCertificateRows(Math.max(1, saved?.certifications.length ?? 0));
      })
      .catch((reason: unknown) => setError(errorMessage(reason, t('loadError'))));
  }, [t]);

  if (!options) {
    return error
      ? <p role="alert">{error} <Link className="text-blue-700 underline" href="/auth/login">{auth('login')}</Link></p>
      : <p>{t('loading')}</p>;
  }

  if (profile?.status === 'PENDING' && !editingPending) {
    return (
      <section className="mx-auto max-w-2xl space-y-4 rounded-xl border border-line bg-white p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <InterpreterProfileStatus profile={profile} inWizard />
        <p className="text-sm text-quiet">{t('editPendingHint')}</p>
        <Button type="button" className="border border-line bg-white text-forest hover:bg-mint" onClick={() => setEditingPending(true)}>
          {t('manageProfile')}
        </Button>
      </section>
    );
  }

  const languagesById = new Map([...options.languages, ...(profile?.savedLanguageOptions ?? [])]
    .map((language) => [language.id, language]));
  const languageOptions = [...languagesById.values()];
  const submitting = step === 5 && profile?.status !== 'APPROVED';
  const homeCity = options.cities.find((city) =>
    profile?.bio === `Based in ${city.name}` || profile?.bio === `Based in city #${city.id}`);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formData = new FormData(event.currentTarget);
    let body: unknown;
    const value = (field: string) => String(formData.get(field) ?? '').trim();
    switch (step) {
      case 1:
        body = { fullName: value('fullName'), headline: value('headline'), cityId: Number(value('homeCity')) };
        break;
      case 2: {
        const targets = formData.getAll('target');
        const languages = formData.getAll('source').map((source, index) => {
          const from = languagesById.get(Number(source));
          const to = languagesById.get(Number(targets[index]));
          if (!from || !to || from.id === to.id) return null;
          return {
            languageId: from.id,
            direction: `${from.name}->${to.name}`,
            proficiencyLevel: profile?.languages[index]?.proficiency_level ?? undefined
          };
        });
        if (languages.some((pair) => pair === null) || new Set(languages.map((pair) => pair?.direction)).size !== languages.length) {
          setError(t('invalidPairs'));
          return;
        }
        body = { languages };
        break;
      }
      case 3:
        body = {
          domainIds: formData.getAll('domains').map(Number),
          coveredCityIds: formData.getAll('cities').map(Number),
          onsiteEnabled: formData.has('onsite'),
          remoteEnabled: formData.has('remote')
        };
        break;
      case 4:
        body = {
          hourlyRateAed: Number(value('rate')),
          yearsExperience: Number(value('years')),
          availabilityNotes: value('availability')
        };
        break;
      default: {
        const urls = formData.getAll('certificateUrl');
        body = {
          certifications: formData.getAll('certificate').map((name, index) => ({
            name: String(name).trim(),
            fileUrl: String(urls[index]).trim(),
            isPrivate: profile?.certifications[index]?.is_private ?? true
          }))
        };
      }
    }

    setBusy(true);
    setError('');
    try {
      await requestJson(`/profile/wizard/step${step}`, { method: 'PUT', authenticated: true, body: JSON.stringify(body) });
      const saved = await requestJson<Profile>('/profile/me', { authenticated: true });
      setProfile(saved);
      setEditingPending(false);
      if (submitting) {
        const review = await requestJson<ProfileReview>('/profile/submit', { method: 'POST', authenticated: true });
        setProfile({ ...saved, ...review });
      } else {
        setStep(Math.min(5, step + 1));
      }
    } catch (reason) {
      setError(errorMessage(reason, t('saveError')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5 rounded-lg border bg-white p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p>{t('stepLabel', { step })}</p>
        {profile && <p className="text-sm text-slate-600">{t(`status.${profile.status}`)}</p>}
        {profile?.rejection_reason && <p className="text-sm text-slate-600">{profile.rejection_reason}</p>}
      </header>
      <form onSubmit={save} className="grid gap-4" key={step}>
        {step === 1 && <>
          <Label htmlFor="fullName">{t('fullName')}</Label>
          <Input id="fullName" name="fullName" defaultValue={profile?.user.full_name} minLength={2} required />
          <Label htmlFor="headline">{t('headline')}</Label>
          <Input id="headline" name="headline" defaultValue={profile?.headline ?? ''} minLength={4} required />
          <Label htmlFor="homeCity">{t('city')}</Label>
          <Select id="homeCity" name="homeCity" defaultValue={homeCity?.id ?? ''} required>
            <option value="" disabled>{t('choose')}</option>
            {options.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </Select>
        </>}
        {step === 2 && <>
          {Array.from({ length: languageRows }, (_, index) => {
            const pair = profile?.languages[index]?.direction.split(/->|→/u) ?? [];
            return <div className="grid gap-2 sm:grid-cols-2" key={index}>
              {[{ field: 'source', label: 'sourceLanguage', name: pair[0] }, { field: 'target', label: 'targetLanguage', name: pair[1] }].map(({ field, label, name }) => {
                const id = `pair-${index}-${field}`;
                return (
                  <div className="grid min-w-0 gap-1.5" key={field}>
                    <Label htmlFor={id}>{t(label)}</Label>
                    <LanguagePicker id={id} name={field} languages={languageOptions} defaultValue={name?.trim()} required />
                  </div>
                );
              })}
            </div>;
          })}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setLanguageRows(languageRows + 1)}>{t('addPair')}</Button>
            {languageRows > 1 && <Button type="button" onClick={() => setLanguageRows(languageRows - 1)}>{t('removeLast')}</Button>}
            <a className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-forest underline" href="mailto:interpreters@nass.life?subject=Language%20suggestion">{languagePicker('suggestLanguage')}</a>
          </div>
        </>}
        {step === 3 && <>
          <Label htmlFor="profile-domains">{t('domains')}</Label>
          <Select id="profile-domains" name="domains" defaultValue={profile?.domains.map((item) => String(item.domain_id))} multiple required>
            {options.domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
          </Select>
          <Label htmlFor="covered-cities">{t('coveredCities')}</Label>
          <Select id="covered-cities" name="cities" defaultValue={profile?.cities.map((item) => String(item.city_id)) ?? (homeCity ? [String(homeCity.id)] : [])} multiple required>
            {options.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </Select>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2"><input type="checkbox" name="onsite" defaultChecked={profile?.onsite_enabled} />{t('onsite')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="remote" defaultChecked={profile?.remote_enabled ?? true} />{t('remote')}</label>
          </div>
        </>}
        {step === 4 && <>
          <Label htmlFor="profile-rate">{t('hourlyRate')}</Label>
          <Input id="profile-rate" name="rate" type="number" min="0.01" step="0.01" defaultValue={profile?.hourly_rate_aed ?? ''} required />
          <Label htmlFor="profile-years">{t('experience')}</Label>
          <Input id="profile-years" name="years" type="number" min="0" defaultValue={profile?.years_experience ?? 0} required />
          <Label htmlFor="availability">{t('availability')}</Label>
          <Textarea id="availability" name="availability" defaultValue={profile?.availability_notes ?? ''} minLength={3} required />
        </>}
        {step === 5 && <>
          {Array.from({ length: certificateRows }, (_, index) => (
            <div className="grid gap-2" key={index}>
              <Label className="grid gap-2">{t('certificate')}
                <Input name="certificate" defaultValue={profile?.certifications[index]?.name} minLength={2} required />
              </Label>
              <Label className="grid gap-2">{t('certificateUrl')}
                <Input name="certificateUrl" type="url" defaultValue={profile?.certifications[index]?.file_url} required />
              </Label>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setCertificateRows(certificateRows + 1)}>{t('addCertificate')}</Button>
            {certificateRows > 1 && <Button type="button" onClick={() => setCertificateRows(certificateRows - 1)}>{t('removeLast')}</Button>}
          </div>
        </>}
        <div className="flex flex-wrap gap-2">
          {step > 1 && <Button type="button" onClick={() => setStep(step - 1)} disabled={busy}>{t('back')}</Button>}
          <Button type="submit" disabled={busy}>{t(submitting ? 'saveAndSubmit' : 'save')}</Button>
        </div>
      </form>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </section>
  );
}
