'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { useToast } from '../../../../components/providers/toast-provider';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

type Step = 1 | 2 | 3 | 4 | 5;

export default function ProfileWizardPage() {
  const t = useTranslations('profileWizard');
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>(1);

  async function callApi(path: string, payload: unknown) {
    const token = localStorage.getItem('im_token');
    const response = await fetch(`${apiBase}${path}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      showToast({ title: t('errorTitle'), description: t('saveError'), tone: 'error' });
      return;
    }
    showToast({ title: t('successTitle'), description: t('saved') });
    setStep((prev) => (prev < 5 ? ((prev + 1) as Step) : prev));
  }

  return (
    <section className="space-y-6 rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p>{t('stepLabel', { step })}</p>

      {step === 1 && <form action={(fd)=>callApi('/api/profile/wizard/step1',{fullName:String(fd.get('fullName')||''),headline:String(fd.get('headline')||''),cityId:Number(fd.get('cityId')||1)})} className="grid gap-2"><Input name="fullName" placeholder={t('fullName')} required/><Input name="headline" placeholder={t('headline')} required/><Input name="cityId" defaultValue="1" required/><Button>{t('save')}</Button></form>}
      {step === 2 && <form action={(fd)=>callApi('/api/profile/wizard/step2',{languages:[{languageId:Number(fd.get('languageId')||1),direction:String(fd.get('direction')||'Arabic->English'),proficiencyLevel:'Professional'}]})} className="grid gap-2"><Input name="languageId" defaultValue="1" required/><Input name="direction" required/><Button>{t('save')}</Button></form>}
      {step === 3 && <form action={(fd)=>callApi('/api/profile/wizard/step3',{domainIds:[Number(fd.get('domainId')||1)],onsiteEnabled:Boolean(fd.get('onsite')),remoteEnabled:Boolean(fd.get('remote')),coveredCityIds:[Number(fd.get('cityId')||1)]})} className="grid gap-2"><Input name="domainId" defaultValue="1" required/><Input name="cityId" defaultValue="1" required/><label><input name="onsite" type="checkbox"/> {t('onsite')}</label><label><input defaultChecked name="remote" type="checkbox"/> {t('remote')}</label><Button>{t('save')}</Button></form>}
      {step === 4 && <form action={(fd)=>callApi('/api/profile/wizard/step4',{hourlyRateAed:Number(fd.get('rate')||100),yearsExperience:Number(fd.get('years')||1),availabilityNotes:String(fd.get('notes')||'')})} className="grid gap-2"><Input name="rate" required/><Input name="years" required/><Textarea name="notes" required/><Button>{t('save')}</Button></form>}
      {step === 5 && <form action={(fd)=>callApi('/api/profile/wizard/step5',{certifications:[{name:String(fd.get('name')||''),fileUrl:String(fd.get('url')||''),isPrivate:true}]})} className="grid gap-2"><Input name="name" required/><Input name="url" required/><Button>{t('save')}</Button></form>}
    </section>
  );
}
