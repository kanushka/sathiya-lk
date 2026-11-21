import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '../../app/SchoolProvider';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { ColorSwatches } from '../register/ColorSwatches';
import * as api from './api';
import { DEFAULT_SUBJECT_COLOR, SHORT_MAX, SUBJECT_SWATCHES } from './palette';

export function SubjectModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('subjects');
  const { school } = useSchool();
  const toast = useToast();
  const [nameEn, setNameEn] = useState('');
  const [nameSi, setNameSi] = useState('');
  const [short, setShort] = useState('');
  const [color, setColor] = useState(DEFAULT_SUBJECT_COLOR);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const nameError = nameEn.trim() ? null : t('modal.errors.name');
  const shortValue = short.trim() || nameEn.trim().slice(0, SHORT_MAX);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (nameError || saving) return;
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
      footer={
        <>
          {saveError && (
            <p role="alert" className="mr-auto text-sm font-medium text-[#A3262A]">
              {t('modal.saveFailed')}
            </p>
          )}
          <Button onClick={onClose}>{t('modal.cancel')}</Button>
          <Button variant="primary" type="submit" form="subject-form" disabled={saving}>
            {t('modal.save')}
          </Button>
        </>
      }
    >
      <form id="subject-form" onSubmit={save} noValidate className="flex flex-col gap-4">
        <Field label={t('modal.nameEn')} error={submitted ? nameError : null}>
          <input className={inputClass} value={nameEn} placeholder={t('modal.nameEnPlaceholder')} onChange={(e) => setNameEn(e.target.value)} />
        </Field>
        <Field label={t('modal.nameSi')} hint={t('modal.nameSiHint')}>
          <input className={inputClass} value={nameSi} placeholder={t('modal.nameSiPlaceholder')} onChange={(e) => setNameSi(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-4">
          <Field label={t('modal.short')} hint={t('modal.shortHint')} className="w-40">
            <input className={inputClass} value={short} maxLength={SHORT_MAX} placeholder={nameEn.trim().slice(0, SHORT_MAX)} onChange={(e) => setShort(e.target.value)} />
          </Field>
          <div className="min-w-[200px] flex-1">
            <ColorSwatches label={t('modal.colour')} swatches={SUBJECT_SWATCHES} value={color} onChange={setColor} />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">{t('modal.preview')}</p>
          <div className="flex flex-col gap-0.5 rounded-[10px] px-2.5 py-2" style={{ background: color, width: 130 }} data-testid="subject-preview">
            <span className="text-[13px] font-bold">{shortValue || t('modal.previewFallback')}</span>
            <span className="text-[11px] opacity-80">{t('modal.previewTeacher')}</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
