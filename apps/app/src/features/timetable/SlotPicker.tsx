// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  periodsFor,
  pickName,
  preferredTeacherFor,
  teacherDisplayName,
  teacherOptionsForSlot,
  type DayIndex,
  type Entry,
  type EntryDraft,
  type TeacherOption,
} from '@sathiya/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { Badge } from '../../ui/Badge';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { Combobox } from '../../ui/Combobox';
import { inputClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { limitWarning, planItemColor, teacherReason, teachesAtAll } from './labels';
import { initials, pickNeed, usePickItems, type GroupItem, type PickItem } from './pickerData';

export type { GroupItem };

export interface SlotPickerProps {
  open: boolean;
  onClose(): void;
  classId: string;
  day: DayIndex;
  period: number;
  entries: Entry[];
  editing?: Entry;
  onSave(d: EntryDraft): Promise<boolean>;
  onClear(id: string): Promise<boolean>;
  onGroup(item: GroupItem): void;
  onCombine(subjectId: string): void;
}

export function SlotPicker(props: SlotPickerProps) {
  const readOnly = useReadOnly();
  if (!props.open || readOnly) return null;
  return <SlotPickerBody {...props} />;
}

function SlotPickerBody({ onClose, classId, day, period, entries, editing, onSave, onClear, onGroup, onCombine }: SlotPickerProps) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const ctx = useSchool();
  const [subjectId, setSubjectId] = useState<string | null>(() => editing?.lessons[0]?.subjectId ?? null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<'assign' | 'clear' | null>(null);
  const [picked, setPicked] = useState(0);
  const preferredRef = useRef<HTMLButtonElement>(null);

  const cls = ctx.classes.find((c) => c.id === classId);
  const grade = cls && ctx.grades.find((g) => g.id === cls.gradeId);
  const template = cls && ctx.templates.find((x) => x.id === cls.templateId);
  const time = template && periodsFor(template, day).find((p) => p.period === period);
  const others = useMemo(() => entries.filter((e) => e.id !== editing?.id), [entries, editing]);

  const items = usePickItems(ctx, classId, others, lang);

  const options = useMemo(() => {
    if (!subjectId || !time) return null;
    return teacherOptionsForSlot({ ctx, entries, classIds: [classId], day, period, subjectId, ...(editing ? { editingEntryId: editing.id } : {}) });
  }, [ctx, entries, classId, day, period, subjectId, editing, time]);

  const preferredId = useMemo(
    () => (subjectId ? preferredTeacherFor({ entries, classId, subjectId, ...(editing ? { excludeEntryId: editing.id } : {}) }) : null),
    [entries, classId, subjectId, editing],
  );

  useEffect(() => {
    if (picked > 0) preferredRef.current?.focus();
  }, [picked]);

  if (!cls || !grade || !time) return null;

  const neededLabel = t('picker.stillNeeded', { class: cls.name });
  const completeLabel = t('picker.complete');
  const chosen = items.find((i) => i.item.kind === 'subject' && i.item.subjectId === subjectId);
  const subject = ctx.subjects.find((s) => s.id === subjectId);
  const groups = items.filter((i) => i.item.kind === 'group');

  const q = query.trim().toLowerCase();
  const matches = (o: TeacherOption) => !q || teacherDisplayName(o.teacher, lang).toLowerCase().includes(q) || o.teacher.staffId.toLowerCase().includes(q);
  const isPreferred = (o: TeacherOption) => o.teacher.id === preferredId;
  const freeMatches = options ? options.available.filter(matches) : [];
  const available = [...freeMatches.filter(isPreferred), ...freeMatches.filter((o) => !isPreferred(o))];
  const notFree = options && subjectId ? options.unavailable.filter((o) => teachesAtAll(o, subjectId) && matches(o)) : [];
  const pinned = notFree.find(isPreferred);
  const unavailable = notFree.filter((o) => !isPreferred(o));
  const preferredTag = subject && (
    <Badge tone="success">{t('picker.teaches', { class: cls.name, subject: pickName(subject, lang) })}</Badge>
  );
  const currentTeacher = editing?.lessons[0]?.teacherId ?? null;
  const currentSubject = editing?.lessons[0]?.subjectId ?? null;
  const isCurrent = (teacherId: string) => teacherId === currentTeacher && subjectId === currentSubject;

  function pick(p: PickItem) {
    if (p.item.kind === 'group') onGroup(p.item);
    else {
      setSubjectId(p.item.subjectId);
      setQuery('');
      setPicked((n) => n + 1);
    }
  }

  async function assign(teacherId: string) {
    if (!subjectId || isCurrent(teacherId)) return;
    setBusy('assign');
    const draft: EntryDraft = {
      ...(editing ? { id: editing.id } : {}),
      day,
      period,
      classIds: [classId],
      lessons: [{ subjectId, teacherId }],
    };
    const ok = await onSave(draft);
    setBusy(null);
    if (ok) onClose();
  }

  async function clear() {
    if (!editing) return;
    setBusy('clear');
    const ok = await onClear(editing.id);
    setBusy(null);
    if (ok) onClose();
  }

  const need = (p: PickItem) => pickNeed(t, p, lang);
  const sectionLabel = 'mb-1.5 mt-3.5 block text-xs font-bold uppercase tracking-[.04em]';

  const unavailableRow = (o: TeacherOption) =>
    o.reason === 'limit' ? (
      <li key={o.teacher.id}>
        <button
          type="button"
          disabled={busy !== null || isCurrent(o.teacher.id)}
          onClick={() => assign(o.teacher.id)}
          className="flex w-full items-center gap-2.5 rounded-lg border border-warning-line bg-warning-soft/50 px-3 py-2 text-left hover:bg-warning-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
        >
          <span className="flex-1 text-[13px] font-semibold text-ink">{teacherDisplayName(o.teacher, lang)}</span>
          {isPreferred(o) && preferredTag}
          <span className="text-xs font-semibold text-warning">{limitWarning(t, o.loadToday, o.teacher.maxPerDay)}</span>
          {o.teacher.id === currentTeacher && (
            <Badge tone="brand">{t('picker.current')}</Badge>
          )}
          {!isCurrent(o.teacher.id) && <span className="text-xs font-bold text-brand">{t('picker.assign')}</span>}
        </button>
      </li>
    ) : (
      <li key={o.teacher.id} className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2 text-ink-muted">
        <span className="flex-1 text-[13px] font-semibold">{teacherDisplayName(o.teacher, lang)}</span>
        {isPreferred(o) && preferredTag}
        <span className="text-xs">{teacherReason(t, o, ctx, lang, grade.number)}</span>
      </li>
    );

  return (
    <Modal
      open
      onClose={onClose}
      title={subjectId ? t('picker.titleTeacher') : t('picker.titleSubject')}
      subtitle={t('picker.slot', { day: tc(`days.long.${day}`), n: period, time: `${time.start}–${time.end}` })}
      width={520}
      busy={busy !== null}
      footer={
        editing || subjectId ? (
          <>
            {editing && (
              <Button variant="danger" className="mr-auto" loading={busy === 'clear'} loadingLabel={t('busy.deleting', { ns: 'common' })} disabled={busy === 'assign'} onClick={clear}>
                {t('picker.clear')}
              </Button>
            )}
            {subjectId && (
              <Button disabled={busy !== null} onClick={() => onCombine(subjectId)}>
                {t('picker.combine')}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      <label htmlFor="slot-picker-subject" className={`${sectionLabel} mt-0 text-ink-muted`}>
        {t('picker.subject')}
      </label>
      <Combobox<PickItem>
        id="slot-picker-subject"
        items={items}
        getKey={(p) => p.key}
        getLabel={(p) => p.name}
        groupBy={(p) => (p.placed < p.needed ? neededLabel : completeLabel)}
        value={chosen}
        onChange={pick}
        placeholder={t('picker.subjectPlaceholder')}
        searchPlaceholder={t('picker.subjectSearch')}
        renderItem={(p) => (
          <>
            <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: planItemColor(p.item, ctx) }} />
            <span className="flex-1 font-semibold">{p.name}</span>
            <span className={p.placed < p.needed ? 'text-xs font-bold text-warning' : 'text-xs text-ink-muted'}>{need(p)}</span>
          </>
        )}
      />
      {chosen && <p className="mt-1.5 text-xs text-warning">{need(chosen)}</p>}

      {subjectId && options && (
        <>
          <label htmlFor="slot-picker-teacher" className={`${sectionLabel} text-ink-muted`}>
            {t('picker.teacher')}
          </label>
          <input
            id="slot-picker-teacher"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('picker.teacherSearch')}
            className={inputClass}
          />
          {q && available.length + unavailable.length === 0 && !pinned && (
            <p className="mx-0.5 mt-3 text-[13px] text-ink-muted">
              {t('picker.noTeacherMatch', { subject: subject ? pickName(subject, lang) : subjectId, q: query.trim() })}
            </p>
          )}
          {pinned && <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">{unavailableRow(pinned)}</ul>}
          <p className={`${sectionLabel} text-success`}>{t('picker.available', { count: available.length })}</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {available.map((o) => (
              <li key={o.teacher.id}>
                <button
                  ref={isPreferred(o) ? preferredRef : undefined}
                  type="button"
                  disabled={busy !== null || isCurrent(o.teacher.id)}
                  onClick={() => assign(o.teacher.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-success-line bg-success-soft/50 px-3 py-2.5 text-left hover:bg-success-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  <span aria-hidden="true" className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-extrabold text-success">
                    {initials(o.teacher.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm">{teacherDisplayName(o.teacher, lang)}</strong>
                    <span className="text-xs text-ink-muted">
                      {t('picker.freeNote', { staffId: o.teacher.staffId, load: o.loadToday, max: o.teacher.maxPerDay, day: tc(`days.long.${day}`) })}
                    </span>
                  </span>
                  {isPreferred(o) && preferredTag}
                  {o.teacher.id === currentTeacher && (
                    <Badge tone="brand">{t('picker.current')}</Badge>
                  )}
                  {!isCurrent(o.teacher.id) && <span className="text-xs font-bold text-brand">{t('picker.assign')}</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className={`${sectionLabel} text-ink-muted`}>{t('picker.unavailable', { count: unavailable.length })}</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {unavailable.map(unavailableRow)}
          </ul>
        </>
      )}
      {groups.length > 0 && (
        <p className="mt-3 text-xs text-ink-muted">{t('picker.groupHint', { groups: groups.map((g) => g.name).join(' / ') })}</p>
      )}
    </Modal>
  );
}
