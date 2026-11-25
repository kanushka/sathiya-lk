// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { suggestStaffPrefix, titleCase, type MoeLang, type MoeSchool } from '@sathiya/core';
import { useId, useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { LinkButton } from '../../ui/LinkButton';
import { Select } from '../../ui/Select';
import { DISTRICTS, listedOk, prefixOk, siFirst, type SchoolDraft } from './model';

const card = 'rounded-2xl border-2 border-teal bg-white p-5 sm:p-7';

export interface CensusEntryProps {
  census: string;
  onCensus(v: string): void;
  onFind(): void;
  onNotListed(): void;
  looking?: boolean;
  error?: string | null;
  taken?: boolean;
  onReport?(): void;
  onTryAnother?(): void;
}

export function CensusEntry({ census, onCensus, onFind, onNotListed, looking, error, taken, onReport, onTryAnother }: CensusEntryProps) {
  const { t } = useTranslation('register');
  return (
    <section className={card}>
      <h2 tabIndex={-1} className="mb-1 mt-0 text-lg font-bold outline-none">{t('census.title')}</h2>
      <p className="mb-5 mt-0 text-sm text-ink-muted">{t('census.subtitle')}</p>
      <form
        className="flex flex-wrap items-start gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onFind();
        }}
      >
        <Field label={t('census.label')} hint={taken ? undefined : t('census.hint')} error={taken ? t('census.taken') : error} className="min-w-[200px] flex-1">
          <input
            className={`${inputClass} tracking-[.08em]`}
            inputMode="numeric"
            maxLength={6}
            placeholder={t('census.placeholder')}
            value={census}
            onChange={(e) => onCensus(e.target.value.replace(/\s/g, ''))}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={looking} className="mt-[26px]">
          <Icon name="search" size={16} />
          {t('census.find')}
        </Button>
      </form>
      {taken ? (
        <div className="mt-5 rounded-xl border border-line bg-surface p-4">
          <Badge tone="warning">{t('census.takenBadge')}</Badge>
          <p className="mb-0 mt-2 text-sm text-ink-muted">
            <Trans t={t} i18nKey="census.report" components={{ report: <Button variant="link" onClick={onReport} className="underline" /> }} />
          </p>
          <div className="mt-4 flex flex-wrap justify-between gap-3">
            <Button onClick={onTryAnother}>{t('census.tryAnother')}</Button>
            <LinkButton to="/login">{t('census.signIn')}</LinkButton>
          </div>
        </div>
      ) : (
        <div className="mt-6 border-t border-line-soft pt-5">
          <Button variant="link" onClick={onNotListed}>
            {t('census.notListed')}
          </Button>
          <p className="mb-0 mt-1 text-sm text-ink-muted">{t('census.notListedHint')}</p>
        </div>
      )}
    </section>
  );
}

function useMediaLabel() {
  const { t, i18n } = useTranslation('register');
  return (media: readonly MoeLang[]) =>
    new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(media.map((m) => t(`school.media.${m}`)));
}

export interface ConfirmSchoolProps {
  moe: MoeSchool;
  value: SchoolDraft;
  onChange(next: SchoolDraft): void;
  onNotMine(): void;
  onNext(): void;
}

export function ConfirmSchool({ moe, value, onChange, onNotMine, onNext }: ConfirmSchoolProps) {
  const { t } = useTranslation('register');
  const mediaLabel = useMediaLabel();
  const id = useId();
  const [siTouched, setSiTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);
  const sinhala = siFirst(moe.media);
  const span = t('confirm.gradeSpan', { from: value.gradeFrom, to: value.gradeTo });
  const example = prefixOk(value.staffPrefix) ? value.staffPrefix : suggestStaffPrefix(value.nameEn) || 'SCC';
  const siMissing = sinhala && (siTouched || submitted) && value.nameSi.trim() === '';
  const cityMissing = (cityTouched || submitted) && value.city.trim() === '';
  const districtMissing = submitted && value.district.trim() === '';
  const prefixBad = (value.staffPrefix !== '' || submitted) && !prefixOk(value.staffPrefix);
  const rows: [string, ReactNode][] = [
    [t('confirm.officialName'), <b key="n">{titleCase(moe.name)}</b>],
    [t('confirm.censusNo'), value.censusNo],
    ...(moe.address ? [[t('confirm.address'), titleCase(moe.address)] as [string, ReactNode]] : []),
    [t('confirm.level'), t(`confirm.levels.${moe.level}`, { defaultValue: moe.level })],
    ...(moe.grades.length ? [[t('confirm.grades'), span] as [string, ReactNode]] : []),
    ...(moe.media.length ? [[t('confirm.medium'), mediaLabel(moe.media)] as [string, ReactNode]] : []),
    [t('confirm.students'), t(`confirm.sex.${moe.sex}`, { defaultValue: moe.sex })],
    ...(moe.district ? [[t('confirm.district'), moe.district] as [string, ReactNode]] : []),
  ];

  const siField = (
    <Field
      key="si"
      label={t('school.nameSi')}
      required={sinhala}
      hint={t('confirm.nameSiHint')}
      error={siMissing ? t('confirm.nameSiRequired') : undefined}
    >
      <input
        className={inputClass}
        lang="si"
        value={value.nameSi}
        onChange={(e) => {
          setSiTouched(true);
          onChange({ ...value, nameSi: e.target.value });
        }}
        onBlur={() => setSiTouched(true)}
      />
    </Field>
  );
  const enField = (
    <div key="en" className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`${id}-en`} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
        {t('school.nameEn')}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={t('confirm.locked')}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </label>
      <input id={`${id}-en`} className={inputClass} value={value.nameEn} disabled aria-describedby={`${id}-en-hint`} />
      <p id={`${id}-en-hint`} className="m-0 text-xs text-ink-muted">
        {t('confirm.nameEnHint')}
      </p>
    </div>
  );

  return (
    <section className={card}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 tabIndex={-1} className="mb-1 mt-0 text-lg font-bold outline-none">{t('confirm.title')}</h2>
          <p className="m-0 text-sm text-ink-muted">{t('confirm.subtitle', { census: value.censusNo })}</p>
        </div>
        <Badge tone="success" dot>
          {t('confirm.badge')}
        </Badge>
      </div>
      <dl className="m-0 grid gap-x-6 gap-y-2 rounded-xl border border-line bg-surface p-4 text-sm sm:grid-cols-2">
        {rows.map(([label, v]) => (
          <div key={label} className="flex min-w-0 gap-2">
            <dt className="w-28 shrink-0 text-ink-muted">{label}</dt>
            <dd className="m-0 min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-col gap-3.5">
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-1.5 p-0 text-[13px] font-semibold text-ink-soft">{t('confirm.nameLegend')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">{sinhala ? [siField, enField] : [enField, siField]}</div>
        </fieldset>
        {!moe.district && (
          <Field label={t('school.district')} required hint={t('confirm.districtHint')} error={districtMissing ? t('errors.required') : undefined}>
            <Select
              searchable
              value={value.district}
              onChange={(district) => onChange({ ...value, district })}
              options={DISTRICTS.map((d) => ({ value: d, label: d }))}
            />
          </Field>
        )}
        <Field label={t('school.city')} required error={cityMissing ? t('school.cityError') : undefined}>
          <input
            className={inputClass}
            value={value.city}
            onChange={(e) => {
              setCityTouched(true);
              onChange({ ...value, city: e.target.value });
            }}
          />
        </Field>
        <Field
          label={t('school.prefix')}
          hint={t('school.prefixHint', { example1: `${example}001`, example2: `${example}024` })}
          error={prefixBad ? t('school.prefixError') : undefined}
        >
          <input
            className={`${inputClass} uppercase tracking-[.08em]`}
            maxLength={5}
            spellCheck={false}
            value={value.staffPrefix}
            onChange={(e) => onChange({ ...value, staffPrefix: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })}
          />
        </Field>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-ink-soft">
          {moe.grades.length > 0 && (
            <li>
              <Trans t={t} i18nKey="confirm.gradesNote" values={{ span }} components={{ b: <b /> }} />
            </li>
          )}
          {sinhala && (
            <li>
              <Trans t={t} i18nKey="confirm.siNote" components={{ b: <b /> }} />
            </li>
          )}
          <li>
            <Trans t={t} i18nKey="confirm.liveNote" components={{ b: <b /> }} />
          </li>
        </ul>
      </div>
      <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-line-soft pt-5">
        <Button size="lg" onClick={onNotMine}>
          {t('confirm.notMine')}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            setSubmitted(true);
            if (listedOk(value)) onNext();
          }}
        >
          {t('confirm.next')}
        </Button>
      </div>
    </section>
  );
}
