// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { formatStaffId, isValidStaffId, nextStaffNumber, pickName, splitTitle, TEACHER_TITLE_LABELS, TEACHER_TITLES, teacherDisplayName, type Lang, type Teacher, type TeacherTitle } from '@sathiya/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { Field, inputClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { Select } from '../../ui/Select';
import { useToast } from '../../ui/Toast';
import { useSchool } from '../../app/SchoolProvider';
import * as api from './api';
import { LoginSlip } from './LoginSlip';
import { useSessionPasswords } from './sessionPasswords';
import { teacherLoginUrl } from './slip';

export interface TeacherModalProps {
  teacher?: Teacher;
  onClose: () => void;
}

interface Form {
  staffId: string;
  title: TeacherTitle | '';
  name: string;
  isPrimary: boolean;
  subjectIds: string[];
  grades: number[];
  maxPerDay: string;
  phone: string;
  email: string;
}

function initialName(teacher: Teacher | undefined): { title: TeacherTitle | ''; name: string } {
  if (!teacher) return { title: '', name: '' };
  const split = splitTitle(teacher.name);
  if (teacher.title) return { title: teacher.title, name: split.title === teacher.title ? split.name : teacher.name };
  return { title: split.title ?? '', name: split.name };
}

const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function TeacherModal({ teacher, onClose }: TeacherModalProps) {
  const { t, i18n } = useTranslation('teachers');
  const lang = i18n.language as Lang;
  const { school, teachers, subjects } = useSchool();
  const readOnly = useReadOnly();
  const toast = useToast();
  const { passwords, set: setSessionPassword } = useSessionPasswords();
  const [form, setForm] = useState<Form>(() => ({
    staffId: teacher?.staffId ?? formatStaffId(school.staffPrefix, nextStaffNumber(teachers.map((x) => x.staffId), school.staffPrefix)),
    ...initialName(teacher),
    isPrimary: teacher?.isPrimary ?? false,
    subjectIds: teacher?.subjectIds ?? [],
    grades: teacher?.grades ?? [],
    maxPerDay: String(teacher?.maxPerDay ?? 7),
    phone: teacher?.phone ?? '',
    email: teacher?.email ?? '',
  }));
  const [savedId, setSavedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(false);

  const teacherId = teacher?.id ?? savedId;
  const locked = readOnly;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const maxPerDay = Number(form.maxPerDay);
  const errors = {
    name: form.name.trim() ? null : t('modal.errors.name'),
    staffId: teacher
      ? null
      : !isValidStaffId(school.staffPrefix, form.staffId)
        ? t('modal.errors.staffId', { example: formatStaffId(school.staffPrefix, 24) })
        : teachers.some((x) => x.staffId === form.staffId && x.id !== teacherId)
          ? t('modal.errors.staffIdTaken')
          : null,
    subjects: form.isPrimary || form.subjectIds.length > 0 ? null : t('modal.errors.subjects'),
    grades: form.grades.length > 0 ? null : t('modal.errors.grades'),
    maxPerDay: Number.isInteger(maxPerDay) && maxPerDay >= 1 && maxPerDay <= 10 ? null : t('modal.errors.maxPerDay'),
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
      isPrimary: form.isPrimary,
      subjectIds: form.isPrimary ? [] : form.subjectIds,
      grades: [...form.grades].sort((a, b) => a - b),
      maxPerDay,
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
    };
    setSaving(true);
    setSaveError(false);
    try {
      if (teacher) {
        await api.updateTeacher(school.id, teacher.id, input);
        toast.show(t('modal.saved'), 'success');
        onClose();
      } else {
        const res = await api.createTeacher(school.id, input);
        setSessionPassword(res.teacherId, res.password);
        setSavedId(res.teacherId);
      }
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!teacherId) return;
    setResetting(true);
    setResetError(false);
    try {
      setSessionPassword(teacherId, await api.resetTeacherPassword(school.id, teacherId));
    } catch {
      setResetError(true);
    } finally {
      setResetting(false);
    }
  }

  const chip = (on: boolean) =>
    cx(
      'rounded-md border px-2.5 py-1 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60',
      on ? 'border-brand bg-brand text-on-brand' : 'border-line-strong bg-white text-ink-soft hover:bg-slate-50',
    );

  return (
    <Modal
      open
      width={900}
      title={teacher ? t('modal.titleEdit') : t('modal.titleAdd')}
      subtitle={teacher ? `${teacherDisplayName(teacher, lang)} · ${teacher.staffId}` : undefined}
      onClose={onClose}
      footer={
        savedId ? (
          <Button variant="primary" onClick={onClose}>
            {t('modal.done')}
          </Button>
        ) : (
          <>
            {saveError && (
              <p role="alert" className="mr-auto text-sm font-medium text-danger">
                {t('modal.saveFailed')}
              </p>
            )}
            <Button onClick={onClose}>{t('modal.cancel')}</Button>
            {!readOnly && (
              <Button variant="primary" type="submit" form="teacher-form" disabled={saving}>
                {saving ? t('modal.saving') : t('modal.save')}
              </Button>
            )}
          </>
        )
      }
    >
      <div className={savedId ? 'mx-auto max-w-[340px]' : 'grid gap-8 md:grid-cols-[1fr_300px]'}>
        {!savedId && (
        <form id="teacher-form" onSubmit={save} noValidate className="flex flex-col gap-4">
          <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
            <div className="grid grid-cols-[140px_110px_1fr] gap-3">
              <Field label={t('modal.staffId')} error={show('staffId')}>
                <input
                  className={inputClass}
                  value={form.staffId}
                  disabled={locked || !!teacher}
                  onChange={(e) => set('staffId', e.target.value.toUpperCase())}
                />
              </Field>
              <Field label={t('modal.title')}>
                <Select value={form.title} onChange={(e) => set('title', e.target.value as Form['title'])}>
                  <option value="">{t('modal.noTitle')}</option>
                  {TEACHER_TITLES.map((x) => (
                    <option key={x} value={x}>
                      {TEACHER_TITLE_LABELS[lang === 'si' ? 'si' : 'en'][x]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('modal.name')} error={show('name')}>
                <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-[#FAFAFB] p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                checked={form.isPrimary}
                onChange={(e) => set('isPrimary', e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-ink">{t('modal.primary')}</span>
                <span className="block text-xs text-ink-muted">{t('modal.primaryHint')}</span>
              </span>
            </label>
            {!form.isPrimary && (
              <div role="group" aria-labelledby="teacher-subjects">
                <p id="teacher-subjects" className="mb-1.5 text-[13px] font-semibold text-ink-soft">
                  {t('modal.subjects')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {subjects.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={form.subjectIds.includes(s.id)}
                      className={chip(form.subjectIds.includes(s.id))}
                      onClick={() => set('subjectIds', toggle(form.subjectIds, s.id))}
                    >
                      {pickName(s, lang)}
                    </button>
                  ))}
                </div>
                {show('subjects') && <p role="alert" className="mt-1 text-xs font-medium text-danger">{show('subjects')}</p>}
              </div>
            )}
            <div role="group" aria-labelledby="teacher-grades">
              <p id="teacher-grades" className="mb-1.5 text-[13px] font-semibold text-ink-soft">
                {t('modal.grades')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...school.grades].sort((a, b) => a - b).map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={form.grades.includes(g)}
                    className={cx(chip(form.grades.includes(g)), 'min-w-9')}
                    onClick={() => set('grades', toggle(form.grades, g))}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {show('grades') && <p role="alert" className="mt-1 text-xs font-medium text-danger">{show('grades')}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
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
              <Field label={t('modal.phone')}>
                <input type="tel" className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
              <Field label={t('modal.email')}>
                <input type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
              </Field>
            </div>
          </fieldset>
        </form>
        )}
        <LoginSlip
          slip={{
            schoolName: pickName(school, lang),
            staffId: form.staffId,
            name: teacherDisplayName({ name: form.name, ...(form.title ? { title: form.title } : {}) }, lang),
            password: teacherId ? passwords[teacherId] : undefined,
            url: teacherLoginUrl(window.location.origin, school.id),
          }}
          hasStaffId={!!teacherId}
          focusPrint={!!savedId}
          onReset={teacherId && !readOnly ? reset : undefined}
          resetting={resetting}
          resetError={resetError}
        />
      </div>
    </Modal>
  );
}
