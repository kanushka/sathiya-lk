// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { formatStaffId, isValidStaffId, nextStaffNumber, normalizeTeacher, pickName, splitTitle, TEACHER_TITLE_LABELS, TEACHER_TITLES, teacherDisplayName, type Lang, type Teacher, type TeacherTitle } from '@sathiya/core';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { ToggleChip } from '../../ui/Chip';
import { Field, inputClass } from '../../ui/Field';
import { FormError } from '../../ui/FormError';
import { Modal } from '../../ui/Modal';
import { NameFields } from '../../ui/NameFields';
import { MultiSelect } from '../../ui/MultiSelect';
import { Select } from '../../ui/Select';
import { useToast } from '../../ui/Toast';
import { useSchool } from '../../app/SchoolProvider';
import { isSchoolDisabled } from '../../lib/callable';
import * as api from './api';

export interface TeacherModalProps {
  teacher?: Teacher;
  onClose: () => void;
  /** Extra controls at the start of the footer, such as a ⋯ menu on phones. */
  footerStart?: ReactNode;
}

interface Form {
  staffId: string;
  title: TeacherTitle | '';
  name: string;
  nameSi: string;
  isPrimary: boolean;
  subjectIds: string[];
  grades: number[];
  maxPerDay: string;
  minPerWeek: string;
  phone: string;
  email: string;
}

function initialName(raw: Teacher | undefined): { title: TeacherTitle | ''; name: string } {
  if (!raw) return { title: '', name: '' };
  const teacher = normalizeTeacher(raw);
  const split = splitTitle(teacher.name);
  if (teacher.title) return { title: teacher.title, name: split.title === teacher.title ? split.name : teacher.name };
  return { title: split.title ?? '', name: split.name };
}

const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function TeacherModal({ teacher, onClose, footerStart }: TeacherModalProps) {
  const { t, i18n } = useTranslation('teachers');
  const lang = i18n.language as Lang;
  const { school, teachers, subjects } = useSchool();
  const readOnly = useReadOnly();
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => ({
    staffId: teacher?.staffId ?? formatStaffId(school.staffPrefix, nextStaffNumber(teachers.map((x) => x.staffId), school.staffPrefix)),
    ...initialName(teacher),
    nameSi: teacher?.nameSi ?? '',
    isPrimary: teacher?.isPrimary ?? false,
    subjectIds: teacher?.subjectIds ?? [],
    grades: teacher?.grades ?? [],
    maxPerDay: String(teacher?.maxPerDay ?? 7),
    minPerWeek: teacher?.minPerWeek === undefined ? '' : String(teacher.minPerWeek),
    phone: teacher?.phone ?? '',
    email: teacher?.email ?? '',
  }));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const locked = readOnly;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const maxPerDay = Number(form.maxPerDay);
  const minPerWeek = form.minPerWeek.trim() === '' ? undefined : Number(form.minPerWeek);
  const minPerWeekCap = Number.isInteger(maxPerDay) ? maxPerDay * 5 : 50;
  const errors = {
    name: form.name.trim() || form.nameSi.trim() ? null : t('common:names.missing'),
    staffId: teacher
      ? null
      : !isValidStaffId(school.staffPrefix, form.staffId)
        ? t('modal.errors.staffId', { example: formatStaffId(school.staffPrefix, 24) })
        : teachers.some((x) => x.staffId === form.staffId)
          ? t('modal.errors.staffIdTaken')
          : null,
    subjects: form.isPrimary || form.subjectIds.length > 0 ? null : t('modal.errors.subjects'),
    grades: form.grades.length > 0 ? null : t('modal.errors.grades'),
    maxPerDay: Number.isInteger(maxPerDay) && maxPerDay >= 1 && maxPerDay <= 10 ? null : t('modal.errors.maxPerDay'),
    minPerWeek:
      minPerWeek === undefined || (Number.isInteger(minPerWeek) && minPerWeek >= 0 && minPerWeek <= minPerWeekCap)
        ? null
        : t('modal.errors.minPerWeek', { max: minPerWeekCap }),
  };
  const valid = Object.values(errors).every((e) => e === null);
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid || saving) return;
    const input: api.TeacherInput = {
      staffId: form.staffId,
      ...(form.title ? { title: form.title } : {}),
      name: form.name.trim(),
      ...(form.nameSi.trim() ? { nameSi: form.nameSi.trim() } : {}),
      isPrimary: form.isPrimary,
      subjectIds: form.isPrimary ? [] : form.subjectIds,
      grades: [...form.grades].sort((a, b) => a - b),
      maxPerDay,
      ...(minPerWeek !== undefined ? { minPerWeek } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
    };
    setSaving(true);
    setSaveError(null);
    try {
      if (teacher) {
        await api.updateTeacher(school.id, teacher.id, input);
        toast.show(t('modal.saved'), 'success');
      } else {
        await api.createTeacher(school.id, input);
        toast.show(t('modal.added'), 'success');
      }
      onClose();
    } catch (err) {
      setSaveError(t(isSchoolDisabled(err) ? 'shell:suspended.writeBlocked' : 'modal.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      width={640}
      title={teacher ? t('modal.titleEdit') : t('modal.titleAdd')}
      subtitle={teacher ? `${teacherDisplayName(teacher, lang)} · ${teacher.staffId}` : undefined}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          {footerStart && <div className="mr-auto">{footerStart}</div>}
          {saveError && (
            <FormError className={footerStart ? 'basis-full' : 'mr-auto'}>{saveError}</FormError>
          )}
          <Button onClick={onClose} disabled={saving}>{t('modal.cancel')}</Button>
          {!readOnly && (
            <Button variant="primary" type="submit" form="teacher-form" loading={saving} loadingLabel={t('modal.saving')}>
              {t('modal.save')}
            </Button>
          )}
        </>
      }
    >
      <form id="teacher-form" onSubmit={save} noValidate className="flex flex-col gap-4">
        <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
          <div className="grid grid-cols-[140px_140px] gap-3">
            <Field label={t('modal.staffId')} error={show('staffId')}>
              <input
                className={inputClass}
                value={form.staffId}
                disabled={locked || !!teacher}
                onChange={(e) => set('staffId', e.target.value.toUpperCase())}
              />
            </Field>
            <Field label={t('modal.title')}>
              <Select
                value={form.title}
                onChange={(v) => set('title', v)}
                options={[
                  { value: '', label: t('modal.noTitle') },
                  ...TEACHER_TITLES.map((x) => ({ value: x, label: TEACHER_TITLE_LABELS[lang === 'si' ? 'si' : 'en'][x] })),
                ]}
              />
            </Field>
          </div>
          <NameFields
            enLabel={t('modal.nameEn')}
            siLabel={t('modal.nameSi')}
            en={form.name}
            si={form.nameSi}
            onEn={(v) => set('name', v)}
            onSi={(v) => set('nameSi', v)}
            missing={!!show('name')}
            enPlaceholder={t('modal.namePlaceholderEn')}
            siPlaceholder={t('modal.namePlaceholderSi')}
            hint={t('modal.nameHint')}
            siFirst={school.medium?.includes('si')}
          />
          <div className="rounded-lg border border-line bg-surface p-3">
            <Checkbox
              checked={form.isPrimary}
              onChange={(v) => set('isPrimary', v)}
              disabled={locked}
              label={t('modal.primary')}
              hint={t('modal.primaryHint')}
            />
          </div>
          {!form.isPrimary && (
            <Field label={t('modal.subjects')} error={show('subjects')}>
              <MultiSelect
                value={form.subjectIds}
                onChange={(v) => set('subjectIds', v)}
                placeholder={t('modal.subjectsPlaceholder')}
                maxChips={Infinity}
                disabled={locked}
                wrap
                options={subjects.map((s) => ({ value: s.id, label: pickName(s, lang) }))}
              />
            </Field>
          )}
          <div role="group" aria-labelledby="teacher-grades">
            <p id="teacher-grades" className="mb-1.5 text-[13px] font-semibold text-ink-soft">
              {t('modal.grades')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[...school.grades].sort((a, b) => a - b).map((g) => (
                <ToggleChip
                  key={g}
                  pressed={form.grades.includes(g)}
                  onToggle={() => set('grades', toggle(form.grades, g))}
                  className="min-w-9"
                >
                  {g}
                </ToggleChip>
              ))}
            </div>
            <FormError size="field" className="mt-1">{show('grades')}</FormError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('modal.maxPerDay')} error={show('maxPerDay')}>
              <input
                type="number"
                min={1}
                max={10}
                className={inputClass}
                value={form.maxPerDay}
                onChange={(e) => set('maxPerDay', e.target.value)}
              />
            </Field>
            <Field label={t('modal.minPerWeek')} error={show('minPerWeek')}>
              <input
                type="number"
                min={0}
                max={minPerWeekCap}
                className={inputClass}
                value={form.minPerWeek}
                onChange={(e) => set('minPerWeek', e.target.value)}
              />
            </Field>
            <Field label={t('modal.phone')}>
              <input type="tel" className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label={t('modal.email')}>
              <input type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
