// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { BrandPreview } from './BrandPreview';
import { ColorSwatches, PRIMARY_SWATCHES, SECOND_SWATCHES } from './ColorSwatches';
import { LogoUpload } from './LogoUpload';
import type { BrandDraft } from './model';

export interface StepBrandProps {
  schoolName: string;
  schoolNameSi?: string;
  value: BrandDraft;
  onChange(next: BrandDraft): void;
  onBack(): void;
  onNext(): void;
}

export function StepBrand({ schoolName, schoolNameSi, value, onChange, onBack, onNext }: StepBrandProps) {
  const { t } = useTranslation('register');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border-2 border-teal bg-white p-5 sm:p-7">
      <h2 tabIndex={-1} className="mb-1 mt-0 text-lg font-bold outline-none">{t('brand.title')}</h2>
      <p className="mb-5 mt-0 text-sm text-ink-muted">{t('brand.subtitle')}</p>
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-[1_1_220px] flex-col gap-5">
          <LogoUpload value={value.logo} onChange={(logo) => onChange({ ...value, logo })} onPreview={setLogoUrl} />
          <ColorSwatches
            label={t('brand.primary')}
            swatches={PRIMARY_SWATCHES}
            value={value.primary}
            onChange={(primary) => onChange({ ...value, primary })}
            hint={t('brand.primaryHint', { hex: value.primary.toUpperCase() })}
          />
          <ColorSwatches
            label={t('brand.second')}
            swatches={SECOND_SWATCHES}
            value={value.second}
            onChange={(second) => onChange({ ...value, second })}
            hint={t('brand.secondHint', { hex: value.second.toUpperCase() })}
          />
        </div>
        <div className="flex-[1_1_260px]">
          <BrandPreview name={schoolName} nameSi={schoolNameSi} primary={value.primary} second={value.second} logoUrl={logoUrl} />
        </div>
      </div>
      <div className="mt-7 flex justify-between border-t border-line-soft pt-5">
        <Button size="lg" onClick={onBack}>
          {t('back')}
        </Button>
        <Button variant="primary" size="lg" onClick={onNext}>
          {t('brand.next')}
        </Button>
      </div>
    </section>
  );
}
