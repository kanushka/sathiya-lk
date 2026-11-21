// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  classProgress,
  effectivePlan,
  periodsFor,
  pickName,
  teacherDisplayName,
  teacherOptionsForSlot,
  type DayIndex,
  type Entry,
  type EntryDraft,
  type PlanItem,
  type TeacherOption,
} from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { Combobox } from '../../ui/Combobox';
import { Modal } from '../../ui/Modal';
import { limitWarning, planItemColor, planItemName, teacherReason, teachesAtAll } from './labels';

export type GroupItem = Extract<PlanItem, { kind: 'group' }>;

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

interface PickItem {
  item: PlanItem;
  key: string;
  name: string;
  placed: number;
  needed: number;
}

export function SlotPicker(props: SlotPickerProps) {
  const readOnly = useReadOnly();
  if (!props.open || readOnly) return null;
  return <SlotPickerBody {...props} />;
}

function initials(name: string): string {
  return name
    .replace(/^((Mrs?|Ms|Rev|Ven|Fr|Dr)\.\s*)+/, '')
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function SlotPickerBody({ onClose, classId, day, period, entries, editing, onSave, onClear, onGroup, onCombine }: SlotPickerProps) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const ctx = useSchool();
  const [subjectId, setSubjectId] = useState<string | null>(() => editing?.lessons[0]?.subjectId ?? null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const cls = ctx.classes.find((c) => c.id === classId);
  const grade = cls && ctx.grades.find((g) => g.id === cls.gradeId);
  const template = cls && ctx.templates.find((x) => x.id === cls.templateId);
  const time = template && periodsFor(template, day).find((p) => p.period === period);
  const others = useMemo(() => entries.filter((e) => e.id !== editing?.id), [entries, editing]);

  const items = useMemo<PickItem[]>(() => {
    if (!cls || !grade) return [];
    const rows = classProgress(classId, others, effectivePlan(cls, grade)).map((r) => ({
      item: r.item,
      key: r.key,
      name: planItemName(r.item, ctx, lang),
      placed: r.placed,
      needed: r.needed,
    }));
    return [...rows.filter((r) => r.placed < r.needed), ...rows.filter((r) => r.placed >= r.needed)];
  }, [cls, grade, classId, others, ctx, lang]);

  const options = useMemo(() => {
    if (!subjectId || !time) return null;
    return teacherOptionsForSlot({ ctx, entries, classIds: [classId], day, period, subjectId, ...(editing ? { editingEntryId: editing.id } : {}) });
  }, [ctx, entries, classId, day, period, subjectId, editing, time]);

  if (!cls || !grade || !time) return null;

  const neededLabel = t('picker.stillNeeded', { class: cls.name });
  const completeLabel = t('picker.complete');
  const chosen = items.find((i) => i.item.kind === 'subject' && i.item.subjectId === subjectId);
  const subject = ctx.subjects.find((s) => s.id === subjectId);
  const groups = items.filter((i) => i.item.kind === 'group');

  const q = query.trim().toLowerCase();
  const matches = (o: TeacherOption) => !q || teacherDisplayName(o.teacher, lang).toLowerCase().includes(q) || o.teacher.staffId.toLowerCase().includes(q);
  const available = options ? options.available.filter(matches) : [];
  const unavailable = options && subjectId ? options.unavailable.filter((o) => teachesAtAll(o, subjectId) && matches(o)) : [];
  const currentTeacher = editing?.lessons[0]?.teacherId ?? null;

  function pick(p: PickItem) {
    if (p.item.kind === 'group') onGroup(p.item);
    else {
      setSubjectId(p.item.subjectId);
      setQuery('');
    }
  }

  async function assign(teacherId: string) {
    if (!subjectId) return;
    setBusy(true);
    const draft: EntryDraft = {
      ...(editing ? { id: editing.id } : {}),
      day,
      period,
      classIds: [classId],
      lessons: [{ subjectId, teacherId }],
    };
    const ok = await onSave(draft);
    setBusy(false);
    if (ok) onClose();
  }

  async function clear() {
    if (!editing) return;
    setBusy(true);
    const ok = await onClear(editing.id);
    setBusy(false);
    if (ok) onClose();
  }

  const need = (p: PickItem) => (p.placed < p.needed ? t('picker.needs', { count: p.needed - p.placed }) : t('picker.done', { placed: p.placed, needed: p.needed }));
  const sectionLabel = 'mb-1.5 mt-3.5 block text-xs font-bold uppercase tracking-[.04em]';

  return (
    <Modal
      open
      onClose={onClose}
      title={subjectId ? t('picker.titleTeacher') : t('picker.titleSubject')}
      subtitle={t('picker.slot', { day: tc(`days.long.${day}`), n: period, time: `${time.start}–${time.end}` })}
      width={520}
      footer={
        editing || subjectId ? (
          <>
            {editing && (
              <Button variant="danger" className="mr-auto" disabled={busy} onClick={clear}>
                {t('picker.clear')}
              </Button>
            )}
            {subjectId && (
              <Button disabled={busy} onClick={() => onCombine(subjectId)}>
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
            <span className={p.placed < p.needed ? 'text-xs font-bold text-[#7A5410]' : 'text-xs text-ink-muted'}>{need(p)}</span>
          </>
        )}
      />
      {chosen && <p className="mt-1.5 text-xs text-[#7A5410]">{need(chosen)}</p>}

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
            className="h-10 w-full rounded-[10px] border border-line-strong px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          {q && available.length + unavailable.length === 0 && (
            <p className="mx-0.5 mt-3 text-[13px] text-ink-muted">
              {t('picker.noTeacherMatch', { subject: subject ? pickName(subject, lang) : subjectId, q: query.trim() })}
            </p>
          )}
          <p className={`${sectionLabel} text-[#1F6B34]`}>{t('picker.available', { count: available.length })}</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {available.map((o) => (
              <li key={o.teacher.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => assign(o.teacher.id)}
                  className="flex w-full items-center gap-2.5 rounded-[10px] border border-[#CFE6D4] bg-[#F5FBF6] px-3 py-2.5 text-left hover:bg-[#EAF6ED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60"
                >
                  <span aria-hidden="true" className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#E4F2E7] text-xs font-extrabold text-[#1F6B34]">
                    {initials(o.teacher.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm">{teacherDisplayName(o.teacher, lang)}</strong>
                    <span className="text-xs text-ink-muted">
                      {t('picker.freeNote', { staffId: o.teacher.staffId, load: o.loadToday, max: o.teacher.maxPerDay, day: tc(`days.long.${day}`) })}
                    </span>
                  </span>
                  {o.teacher.id === currentTeacher && (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">{t('picker.current')}</span>
                  )}
                  <span className="text-xs font-bold text-brand">{t('picker.assign')}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className={`${sectionLabel} text-[#8A91A3]`}>{t('picker.unavailable', { count: unavailable.length })}</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {unavailable.map((o) =>
              o.reason === 'limit' ? (
                <li key={o.teacher.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => assign(o.teacher.id)}
                    className="flex w-full items-center gap-2.5 rounded-[10px] border border-[#F0DDB0] bg-[#FFF9EC] px-3 py-2 text-left hover:bg-[#FBF0D6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60"
                  >
                    <span className="flex-1 text-[13px] font-semibold text-ink">{teacherDisplayName(o.teacher, lang)}</span>
                    <span className="text-xs font-semibold text-[#7A5A12]">{limitWarning(t, o.loadToday, o.teacher.maxPerDay)}</span>
                    {o.teacher.id === currentTeacher && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">{t('picker.current')}</span>
                    )}
                    <span className="text-xs font-bold text-brand">{t('picker.assign')}</span>
                  </button>
                </li>
              ) : (
                <li key={o.teacher.id} className="flex items-center gap-2.5 rounded-[10px] bg-[#F6F7F9] px-3 py-2 text-ink-muted">
                  <span className="flex-1 text-[13px] font-semibold">{teacherDisplayName(o.teacher, lang)}</span>
                  <span className="text-xs">{teacherReason(t, o, ctx, lang, grade.number)}</span>
                </li>
              ),
            )}
          </ul>
        </>
      )}
      {groups.length > 0 && (
        <p className="mt-3 text-xs text-ink-muted">{t('picker.groupHint', { groups: groups.map((g) => g.name).join(' / ') })}</p>
      )}
    </Modal>
  );
}
