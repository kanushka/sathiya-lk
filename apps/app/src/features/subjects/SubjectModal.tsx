// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { nameTaken, shortTaken, suggestSubjectShort } from '@sathiya/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '../../app/SchoolProvider';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { FormError } from '../../ui/FormError';
import { ColorSwatches } from '../register/ColorSwatches';
import * as api from './api';
import { DEFAULT_SUBJECT_COLOR, SHORT_MAX, SUBJECT_SWATCHES } from './palette';

export function SubjectModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('subjects');
  const { school, subjects } = useSchool();
  const existingShorts = subjects.map((s) => s.short);
  const existingNamesEn = subjects.map((s) => s.nameEn);
  const existingNamesSi = subjects.map((s) => s.nameSi);
  const toast = useToast();
  const [nameEn, setNameEn] = useState('');
  const [nameSi, setNameSi] = useState('');
  const [short, setShort] = useState('');
  const [shortTouched, setShortTouched] = useState(false);
  const [color, setColor] = useState(DEFAULT_SUBJECT_COLOR);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const nameError = !nameEn.trim()
    ? t('modal.errors.name')
    : nameTaken(nameEn, existingNamesEn)
      ? t('modal.errors.nameTaken', { name: nameEn.trim() })
      : null;
  const nameSiError = nameTaken(nameSi, existingNamesSi) ? t('modal.errors.nameTaken', { name: nameSi.trim() }) : null;
  const suggestion = suggestSubjectShort(nameEn, existingShorts).slice(0, SHORT_MAX);
  const shortValue = short.trim() || suggestion;
  const shortError = shortTaken(shortValue, existingShorts) ? t('modal.errors.shortTaken') : !shortValue && submitted ? t('modal.errors.short') : null;

  function changeName(value: string) {
    setNameEn(value);
    if (!shortTouched) setShort(suggestSubjectShort(value, existingShorts).slice(0, SHORT_MAX));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (nameError || nameSiError || shortError || !shortValue || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await api.addSubject(school.id, { nameEn, nameSi, short: shortValue, color });
      toast.show(t('modal.saved'), 'success');
      onClose();
    } catch {
      setSaveError(true);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      width={560}
      title={t('modal.title')}
      subtitle={t('modal.subtitle')}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          {saveError && (
            <FormError className="mr-auto">{t('modal.saveFailed')}</FormError>
          )}
          <Button onClick={onClose} disabled={saving}>{t('modal.cancel')}</Button>
          <Button variant="primary" type="submit" form="subject-form" loading={saving} loadingLabel={t('busy.saving', { ns: 'common' })}>
            {t('modal.save')}
          </Button>
        </>
      }
    >
      <form id="subject-form" onSubmit={save} noValidate className="flex flex-col gap-4">
        <Field label={t('modal.nameEn')} error={nameError && (submitted || nameTaken(nameEn, existingNamesEn)) ? nameError : null}>
          <input className={inputClass} value={nameEn} placeholder={t('modal.nameEnPlaceholder')} onChange={(e) => changeName(e.target.value)} />
        </Field>
        <Field label={t('modal.nameSi')} hint={t('modal.nameSiHint')} error={nameSiError}>
          <input className={inputClass} value={nameSi} placeholder={t('modal.nameSiPlaceholder')} onChange={(e) => setNameSi(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-4">
          <Field label={t('modal.short')} hint={t('modal.shortHint')} error={shortError} className="w-40">
            <input
              className={inputClass}
              value={short}
              maxLength={SHORT_MAX}
              placeholder={suggestion}
              onChange={(e) => {
                setShortTouched(true);
                setShort(e.target.value);
              }}
            />
          </Field>
          <div className="min-w-[200px] flex-1">
            <ColorSwatches label={t('modal.colour')} swatches={SUBJECT_SWATCHES} value={color} onChange={setColor} />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">{t('modal.preview')}</p>
          <div className="flex flex-col gap-0.5 rounded-lg px-2.5 py-2" style={{ background: color, width: 130 }} data-testid="subject-preview">
            <span className="text-[13px] font-bold">{shortValue || t('modal.previewFallback')}</span>
            <span className="text-[11px] opacity-80">{t('modal.previewTeacher')}</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
