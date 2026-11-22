// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { suggestStaffPrefix, type School } from '@sathiya/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '../../app/SchoolProvider';
import { applyBrand } from '../../lib/theme';
import { useReadOnly } from '../../ui/AdminLayout';
import { Alert } from '../../ui/Alert';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { PageHeader } from '../../ui/PageHeader';
import { useToast } from '../../ui/Toast';
import { uploadLogo } from '../register/api';
import { BrandPreview } from '../register/BrandPreview';
import { ColorSwatches, PRIMARY_SWATCHES, SECOND_SWATCHES } from '../register/ColorSwatches';
import { LogoUpload } from '../register/LogoUpload';
import { prefixOk } from '../register/model';
import * as api from './api';
import { contrastWithWhite, isLowContrast } from './contrast';

const blankToUndefined = (v: string) => (v.trim() === '' ? undefined : v.trim());

export function ProfilePage() {
  const { t } = useTranslation('profile');
  const { t: tr } = useTranslation('register');
  const { school } = useSchool();
  const readOnly = useReadOnly();
  const toast = useToast();
  const [draft, setDraft] = useState(() => ({
    nameEn: school.nameEn,
    nameSi: school.nameSi ?? '',
    city: school.city,
    district: school.district,
    address: school.address ?? '',
    phone: school.phone ?? '',
    staffPrefix: school.staffPrefix,
    primary: school.colors.primary,
    second: school.colors.second,
  }));
  const [prefixTouched, setPrefixTouched] = useState(true);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const saved = useRef(school.colors);
  saved.current = school.colors;
  useEffect(() => () => applyBrand(saved.current), []);

  function pick(key: 'primary' | 'second', hex: string) {
    const next = { ...draft, [key]: hex };
    setDraft(next);
    applyBrand({ primary: next.primary, second: next.second });
  }

  const nameOk = draft.nameEn.trim() !== '';
  const cityOk = draft.city.trim() !== '';
  const prefixValid = prefixOk(draft.staffPrefix);
  const canSave = !readOnly && !saving && nameOk && cityOk && draft.district.trim() !== '' && prefixValid;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (logo) await uploadLogo(school.id, logo);
      await api.updateSchool(school.id, {
        nameEn: draft.nameEn,
        nameSi: blankToUndefined(draft.nameSi),
        city: draft.city,
        district: draft.district,
        address: blankToUndefined(draft.address),
        phone: blankToUndefined(draft.phone),
        staffPrefix: draft.staffPrefix,
        colors: { primary: draft.primary, second: draft.second },
      });
      setLogo(null);
      toast.show(t('page.saved'), 'success');
    } catch {
      toast.show(t('page.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title={t('page.title')} subtitle={t('page.subtitle')} />
      <form
        className="flex flex-wrap gap-6 rounded-[14px] border border-line-soft bg-white p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={readOnly} className="m-0 flex min-w-[300px] flex-[1_1_320px] flex-col gap-3.5 border-0 p-0">
          <Field label={t('fields.nameEn')} error={nameOk ? undefined : t('fields.required')}>
            <input
              className={inputClass}
              value={draft.nameEn}
              onChange={(e) => {
                const nameEn = e.target.value;
                setDraft((d) => ({ ...d, nameEn, ...(prefixTouched ? {} : { staffPrefix: suggestStaffPrefix(nameEn) }) }));
              }}
            />
          </Field>
          <Field label={t('fields.nameSi')}>
            <input lang="si" className={inputClass} value={draft.nameSi} onChange={(e) => set('nameSi', e.target.value)} />
          </Field>
          <div className="flex gap-3">
            <Field label={t('fields.city')} className="flex-1" error={cityOk ? undefined : t('fields.cityError')}>
              <input className={inputClass} value={draft.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label={t('fields.district')} className="flex-1" error={draft.district.trim() === '' ? t('fields.required') : undefined}>
              <input className={inputClass} value={draft.district} onChange={(e) => set('district', e.target.value)} />
            </Field>
          </div>
          <Field label={t('fields.address')}>
            <input className={inputClass} value={draft.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label={t('fields.phone')}>
            <input type="tel" className={inputClass} value={draft.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field
            label={t('fields.prefix')}
            hint={t('fields.prefixHint')}
            error={prefixValid ? undefined : t('fields.prefixError')}
          >
            <input
              className={`${inputClass} uppercase tracking-[.08em]`}
              maxLength={5}
              spellCheck={false}
              value={draft.staffPrefix}
              placeholder={suggestStaffPrefix(draft.nameEn)}
              onChange={(e) => {
                const staffPrefix = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                setPrefixTouched(staffPrefix !== '');
                set('staffPrefix', staffPrefix);
              }}
            />
          </Field>
          <LogoUpload value={logo} currentUrl={school.logoUrl ?? null} onChange={setLogo} onPreview={setLogoUrl} />
          <ColorSwatches label={tr('brand.primary')} swatches={PRIMARY_SWATCHES} value={draft.primary} onChange={(hex) => pick('primary', hex)} />
          {isLowContrast(draft.primary) && (
            <Alert tone="danger">{t('contrast.low', { ratio: contrastWithWhite(draft.primary).toFixed(1) })}</Alert>
          )}
          <ColorSwatches label={tr('brand.second')} swatches={SECOND_SWATCHES} value={draft.second} onChange={(hex) => pick('second', hex)} />
        </fieldset>
        <div className="flex flex-[1_1_260px] flex-col gap-4">
          <BrandPreview name={draft.nameEn} nameSi={draft.nameSi} primary={draft.primary} second={draft.second} logoUrl={logoUrl} />
          {!readOnly && (
            <Button variant="primary" size="lg" type="submit" loading={saving} loadingLabel={t('page.saving')} disabled={!canSave}>
              {t('page.save')}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
