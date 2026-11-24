// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  classOptionsForTeacherSlot,
  effectivePlan,
  periodsFor,
  pickName,
  teacherDayLoad,
  type ClassOption,
  type DayIndex,
  type Entry,
  type EntryDraft,
  type PlanItem,
  type SchoolContext,
  type Subject,
} from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { Badge } from '../../ui/Badge';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { Combobox } from '../../ui/Combobox';
import { Modal } from '../../ui/Modal';
import { busyLabel } from './conflictLabel';
import { classNames, limitWarning } from './labels';
import type { GroupItem } from './SlotPicker';
import { teacherSubjects } from './pickerData';

export interface TeacherSlotPickerProps {
  open: boolean;
  onClose(): void;
  teacherId: string;
  day: DayIndex;
  period: number;
  entries: Entry[];
  editing: Entry;
  onSave(d: EntryDraft): Promise<boolean>;
  onClear(id: string): Promise<boolean>;
  onGroup(args: { classId: string; period: number; subjectId: string; item: GroupItem }): void;
}

export function TeacherSlotPicker(props: TeacherSlotPickerProps) {
  const readOnly = useReadOnly();
  if (!props.open || readOnly) return null;
  return <TeacherSlotPickerBody {...props} />;
}

function planItemFor(ctx: SchoolContext, o: ClassOption, subjectId: string): PlanItem | undefined {
  const grade = ctx.grades.find((g) => g.id === o.cls.gradeId);
  if (!grade) return undefined;
  const plan = effectivePlan(o.cls, grade);
  return (
    plan.find((p) => p.kind === 'subject' && p.subjectId === subjectId) ??
    plan.find((p) => p.kind === 'group' && p.optionSubjectIds.includes(subjectId))
  );
}

function TeacherSlotPickerBody({ onClose, teacherId, day, period, entries, editing, onSave, onClear, onGroup }: TeacherSlotPickerProps) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const ctx = useSchool();
  const [subjectId, setSubjectId] = useState<string | null>(() => editing?.lessons.find((l) => l.teacherId === teacherId)?.subjectId ?? null);
  const [busy, setBusy] = useState<'assign' | 'clear' | null>(null);

  const teacher = ctx.teachers.find((x) => x.id === teacherId);
  const defaultTemplate = ctx.templates.find((x) => x.isDefault);
  const time = defaultTemplate && periodsFor(defaultTemplate, day).find((p) => p.period === period);
  const subjects = useMemo(() => (teacher ? teacherSubjects(teacher, ctx) : []), [teacher, ctx]);

  const options = useMemo(() => {
    if (!subjectId || !time) return [];
    return classOptionsForTeacherSlot({ ctx, entries, teacherId, day, defaultPeriod: period, subjectId, editingEntryId: editing.id });
  }, [ctx, entries, teacherId, day, period, subjectId, editing, time]);

  if (!teacher || !defaultTemplate || !time) return null;

  const subject = ctx.subjects.find((s) => s.id === subjectId);
  const subjectName = (s: Subject) => pickName(s, lang);
  const load = teacherDayLoad(teacher.id, day, entries.filter((e) => e.id !== editing.id), ctx);
  const atLimit = load >= teacher.maxPerDay;
  const free = options.filter((o) => o.free);
  const taken = options.filter((o) => !o.free);

  const classTime = (o: ClassOption) => {
    const tpl = ctx.templates.find((x) => x.id === o.cls.templateId);
    const p = tpl && periodsFor(tpl, day).find((x) => x.period === o.period);
    if (!p || (p.start === time.start && p.end === time.end)) return null;
    return t('teacherPicker.classPeriod', { n: o.period, time: `${p.start}–${p.end}` });
  };

  async function assign(o: ClassOption) {
    if (!subjectId || unchanged(o)) return;
    const item = planItemFor(ctx, o, subjectId);
    if (item?.kind === 'group') {
      onGroup({ classId: o.cls.id, period: o.period, subjectId, item });
      return;
    }
    setBusy('assign');
    const draft: EntryDraft = {
      id: editing.id,
      day,
      period: o.period,
      classIds: [o.cls.id],
      lessons: [{ subjectId, teacherId }],
    };
    const ok = await onSave(draft);
    setBusy(null);
    if (ok) onClose();
  }

  async function clear() {
    setBusy('clear');
    const ok = await onClear(editing.id);
    setBusy(null);
    if (ok) onClose();
  }

  const sectionLabel = 'mb-1.5 mt-3.5 block text-xs font-bold uppercase tracking-[.04em]';
  const isCurrent = (o: ClassOption) => editing.classIds.includes(o.cls.id) && editing.period === o.period;
  const currentSubject = editing.lessons.find((l) => l.teacherId === teacherId)?.subjectId;
  const unchanged = (o: ClassOption) => isCurrent(o) && subjectId === currentSubject;
  const editingSubject = ctx.subjects.find((s) => s.id === editing.lessons.find((l) => l.teacherId === teacherId)?.subjectId);

  const row = (o: ClassOption) => {
    const item = subjectId ? planItemFor(ctx, o, subjectId) : undefined;
    const at = classTime(o);
    const notes = [
      item?.kind === 'group' ? t('teacherPicker.viaGroup', { group: pickName(item, lang) }) : null,
      at,
      o.busy ? busyLabel(t, o.busy, ctx, lang) : null,
    ].filter(Boolean);
    return (
      <li key={o.cls.id}>
        <button
          type="button"
          disabled={busy !== null || !o.free || unchanged(o)}
          onClick={() => assign(o)}
          className={
            o.free
              ? 'flex w-full items-center gap-2.5 rounded-lg border border-success-line bg-success-soft/50 px-3 py-2.5 text-left hover:bg-success-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60'
              : 'flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2 text-left text-ink-muted'
          }
        >
          <strong className="text-sm">{o.cls.name}</strong>
          <span className="min-w-0 flex-1 text-xs text-ink-muted">{notes.join(' · ')}</span>
          {isCurrent(o) && <Badge tone="brand">{t('picker.current')}</Badge>}
          {o.free && !unchanged(o) && <span className="text-xs font-bold text-brand">{t('picker.assign')}</span>}
        </button>
      </li>
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={subjectId ? t('teacherPicker.titleClass') : t('picker.titleSubject')}
      subtitle={t('picker.slot', { day: tc(`days.long.${day}`), n: period, time: `${time.start}–${time.end}` })}
      width={520}
      busy={busy !== null}
      footer={
        <Button variant="danger" className="mr-auto" loading={busy === 'clear'} loadingLabel={t('busy.deleting', { ns: 'common' })} disabled={busy === 'assign'} onClick={clear}>
          {t('picker.clear')}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-ink-soft">
        {t('teacherPicker.currentLesson', { classes: classNames(ctx, editing.classIds), subject: editingSubject ? subjectName(editingSubject) : '' })}
      </p>
      <label htmlFor="teacher-picker-subject" className={`${sectionLabel} mt-0 text-ink-muted`}>
        {t('picker.subject')}
      </label>
      <Combobox<Subject>
        id="teacher-picker-subject"
        items={subjects}
        getKey={(s) => s.id}
        getLabel={subjectName}
        value={subject}
        onChange={(s) => setSubjectId(s.id)}
        placeholder={t('picker.subjectPlaceholder')}
        searchPlaceholder={t('picker.subjectSearch')}
        renderItem={(s) => (
          <>
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="flex-1 font-semibold">{subjectName(s)}</span>
          </>
        )}
      />

      {subject && (
        <>
          {options.length === 0 ? (
            <p className="mx-0.5 mt-3 text-[13px] text-ink-muted">{t('teacherPicker.noClasses', { subject: subjectName(subject) })}</p>
          ) : (
            <>
              {atLimit && <p className="mx-0.5 mt-3 text-xs font-semibold text-warning">{limitWarning(t, load, teacher.maxPerDay)}</p>}
              <p className={`${sectionLabel} text-success`}>{t('teacherPicker.free', { count: free.length })}</p>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">{free.map(row)}</ul>
              {taken.length > 0 && (
                <>
                  <p className={`${sectionLabel} text-ink-muted`}>{t('teacherPicker.taken', { count: taken.length })}</p>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">{taken.map(row)}</ul>
                </>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
