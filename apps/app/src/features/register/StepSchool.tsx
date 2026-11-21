// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { SCHOOL_TYPES, type SchoolType } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Trans } from 'react-i18next';
import { censusError, gradesOk, prefixOk, schoolOk, type SchoolDraft } from './model';


const grades = Array.from({ length: 13 }, (_, i) => i + 1);

export interface StepSchoolProps {
  value: SchoolDraft;
  onChange(next: SchoolDraft): void;
  onNext(): void;
  censusTaken?: boolean;
  onReport?(): void;
}

export function StepSchool({ value, onChange, onNext, censusTaken, onReport }: StepSchoolProps) {
  const { t } = useTranslation('register');
  const set = <K extends keyof SchoolDraft>(k: K, v: SchoolDraft[K]) => onChange({ ...value, [k]: v });
  const [cityTouched, setCityTouched] = useState(false);
  const prefixInvalid = value.staffPrefix !== '' && !prefixOk(value.staffPrefix);
  const censusMsg = censusTaken ? (
    <Trans
      t={t}
      i18nKey="school.censusTaken"
      components={{
        report: (
          <button type="button" onClick={onReport} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[#A3262A] underline" />
        ),
      }}
    />
  ) : censusError(value) ? (
    t('school.censusError')
  ) : undefined;
  const privateLike = value.type !== 'government';
  const example = prefixOk(value.staffPrefix) ? value.staffPrefix : 'SCC';

  return (
    <section className="rounded-2xl border-2 border-teal bg-white p-5 sm:p-7">
      <h2 className="mb-1 mt-0 text-lg font-bold">{t('school.title')}</h2>
      <p className="mb-5 mt-0 text-sm text-ink-muted">{t('school.subtitle')}</p>
      <div className="flex flex-col gap-3.5">
        <div className="flex gap-3">
          <Field label={t('school.type')} className="flex-1">
            <select
              className={inputClass}
              value={value.type}
              onChange={(e) => {
                const type = e.target.value as SchoolType;
                onChange({ ...value, type, ...(type === 'government' ? { noCensus: false } : {}) });
              }}
            >
              {SCHOOL_TYPES.map((k) => (
                <option key={k} value={k}>
                  {t(`school.types.${k}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('school.census')} hint={t('school.censusHint')} error={censusMsg} className="flex-1">
            <input
              className={`${inputClass} tracking-[.08em]`}
              inputMode="numeric"
              maxLength={6}
              disabled={value.noCensus}
              value={value.censusNo}
              onChange={(e) => onChange({ ...value, censusNo: e.target.value.replace(/\s/g, '') })}
            />
          </Field>
        </div>
        <label className="-mt-1 flex items-center gap-2 text-[13px] text-ink-muted">
          <input
            type="checkbox"
            className="h-4 w-4"
            disabled={!privateLike}
            checked={value.noCensus}
            onChange={(e) => onChange({ ...value, noCensus: e.target.checked, censusNo: e.target.checked ? '' : value.censusNo })}
          />
          {t('school.noCensus')}
        </label>
        <Field label={t('school.nameEn')}>
          <input className={inputClass} value={value.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
        </Field>
        <Field label={t('school.nameSi')}>
          <input
            lang="si"
            className={inputClass}
            value={value.nameSi}
            onChange={(e) => set('nameSi', e.target.value)}
          />
        </Field>
        <div className="flex gap-3">
          <Field
            label={t('school.city')}
            className="flex-1"
            error={cityTouched && value.city.trim() === '' ? t('school.cityError') : undefined}
          >
            <input
              className={inputClass}
              value={value.city}
              onChange={(e) => {
                setCityTouched(true);
                set('city', e.target.value);
              }}
            />
          </Field>
          <Field label={t('school.district')} className="flex-1">
            <input className={inputClass} value={value.district} onChange={(e) => set('district', e.target.value)} />
          </Field>
        </div>
        <Field label={t('school.address')}>
          <input className={inputClass} value={value.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <div className="flex gap-3">
          <Field label={t('school.phone')} className="flex-1">
            <input
              type="tel"
              className={inputClass}
              value={value.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <Field label={t('school.gradeFrom')} className="flex-1">
            <select
              className={inputClass}
              value={value.gradeFrom}
              onChange={(e) => set('gradeFrom', Number(e.target.value))}
            >
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t('school.gradeTo')}
            className="flex-1"
            error={gradesOk(value) ? undefined : t('school.gradesError')}
          >
            <select className={inputClass} value={value.gradeTo} onChange={(e) => set('gradeTo', Number(e.target.value))}>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label={t('school.prefix')}
          hint={t('school.prefixHint', { example1: `${example}001`, example2: `${example}024` })}
          error={prefixInvalid ? t('school.prefixError') : undefined}
        >
          <input
            className={`${inputClass} uppercase tracking-[.08em]`}
            maxLength={5}
            spellCheck={false}
            value={value.staffPrefix}
            onChange={(e) => set('staffPrefix', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
        </Field>
      </div>
      <div className="mt-7 flex justify-end border-t border-line-soft pt-5">
        <Button variant="primary" size="lg" disabled={!schoolOk(value)} onClick={onNext}>
          {t('school.next')}
        </Button>
      </div>
    </section>
  );
}
