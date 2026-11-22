// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  effectivePlan,
  joinableClasses,
  pickName,
  teacherDisplayName,
  teacherOptionsForSlot,
  windowOf,
  type DayIndex,
  type Entry,
  type EntryDraft,
  type PlanItem,
  type SchoolClass,
  type TeacherOption,
} from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { Modal } from '../../ui/Modal';
import { Select, type SelectOption } from '../../ui/Select';
import { limitWarning, teacherReason, teachesAtAll } from './labels';

export interface BlockEditorProps {
  open: boolean;
  onClose(): void;
  baseClassId: string;
  day: DayIndex;
  period: number;
  mode: { kind: 'group'; item: Extract<PlanItem, { kind: 'group' }> } | { kind: 'combined'; subjectId: string };
  entry?: Entry;
  entries: Entry[];
  onSave(d: EntryDraft): Promise<boolean>;
  onRemove(id: string): Promise<boolean>;
  preset?: { subjectId: string; teacherId: string };
  replacesEntryId?: string;
}

export function BlockEditor(props: BlockEditorProps) {
  if (!props.open) return null;
  return <BlockEditorBody {...props} />;
}

function BlockEditorBody({ onClose, baseClassId, day, period, mode, entry, entries: allEntries, onSave: save, onRemove: remove, preset, replacesEntryId }: BlockEditorProps) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const readOnly = useReadOnly();
  const ctx = useSchool();
  const [busy, setBusy] = useState(false);

  const findClass = (id: string) => ctx.classes.find((c) => c.id === id);
  const gradeOf = (c: SchoolClass) => ctx.grades.find((g) => g.id === c.gradeId);
  const base = findClass(baseClassId);
  const template = base && ctx.templates.find((x) => x.id === base.templateId);
  const slotExists = !!template && windowOf(template, day, period) !== null;

  const entries = useMemo(() => (replacesEntryId ? allEntries.filter((e) => e.id !== replacesEntryId) : allEntries), [allEntries, replacesEntryId]);
  const optionIds = useMemo(() => (mode.kind === 'group' ? mode.item.optionSubjectIds : [mode.subjectId]), [mode]);
  const [classIds, setClassIds] = useState<string[]>(() => [baseClassId, ...(entry?.classIds ?? []).filter((c) => c !== baseClassId)]);
  const [teachers, setTeachers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      optionIds.map((id) => [id, entry?.lessons.find((l) => l.subjectId === id)?.teacherId ?? (preset?.subjectId === id ? preset.teacherId : null)]),
    ),
  );

  const subjectName = (id: string) => {
    const s = ctx.subjects.find((x) => x.id === id);
    return s ? pickName(s, lang) : id;
  };

  const chips = useMemo<SchoolClass[]>(() => {
    if (!base) return [];
    const joinable = joinableClasses({ ctx, entries, baseClassId, day, period, ...(entry ? { editingEntryId: entry.id } : {}) });
    return joinable.filter((c) => {
      const grade = gradeOf(c);
      if (!grade) return false;
      return effectivePlan(c, grade).some((p) =>
        mode.kind === 'group' ? p.kind === 'group' && p.key === mode.item.key : p.kind === 'subject' && p.subjectId === mode.subjectId,
      );
    });
  }, [ctx, entries, base, baseClassId, day, period, entry, mode]);

  const statuses = useMemo(() => {
    const out: Record<string, { available: TeacherOption[]; unavailable: TeacherOption[] }> = {};
    if (!slotExists) return out;
    for (const id of optionIds) {
      out[id] = teacherOptionsForSlot({ ctx, entries, classIds, day, period, subjectId: id, ...(entry ? { editingEntryId: entry.id } : {}) });
    }
    return out;
  }, [ctx, entries, classIds, day, period, entry, slotExists, optionIds]);

  if (!base || !slotExists) return null;

  const reasonText = (o: TeacherOption) => teacherReason(t, o, ctx, lang, gradeOf(base)?.number ?? '');
  const optionLabel = (o: TeacherOption) =>
    o.reason
      ? `${teacherDisplayName(o.teacher, lang)} · ${o.teacher.staffId} · ${reasonText(o)}`
      : `${teacherDisplayName(o.teacher, lang)} · ${o.teacher.staffId} · ${t('block.load', { load: o.loadToday, max: o.teacher.maxPerDay })} ${t('block.free')}`;

  const chosen = optionIds.map((id) => teachers[id] ?? null);
  const problems = optionIds.map((id) => {
    const tid = teachers[id] ?? null;
    if (!tid) return { missing: true as const };
    const s = statuses[id];
    const o = s && [...s.available, ...s.unavailable].find((x) => x.teacher.id === tid);
    return {
      duplicate: chosen.filter((c) => c === tid).length > 1,
      hard: o?.reason === 'busy' || o?.reason === 'not-qualified' ? o : undefined,
      limit: o?.reason === 'limit' ? o : undefined,
    };
  });
  const blocked = problems.some((p) => !('missing' in p) && (p.duplicate || p.hard));
  const tooFew = mode.kind === 'combined' && classIds.length < 2;

  const toggle = (id: string) => setClassIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function onSave() {
    setBusy(true);
    const draft: EntryDraft = {
      ...(entry ? { id: entry.id } : {}),
      day,
      period,
      classIds,
      lessons: optionIds.map((id) => ({ subjectId: id, teacherId: teachers[id] ?? null })),
      ...(mode.kind === 'group' ? { groupKey: mode.item.key } : {}),
    };
    const ok = await save(draft);
    if (ok && replacesEntryId) await remove(replacesEntryId);
    setBusy(false);
    if (ok) onClose();
  }

  async function onRemove() {
    if (!entry) return;
    setBusy(true);
    const ok = await remove(entry.id);
    setBusy(false);
    if (ok) onClose();
  }

  const title = mode.kind === 'group' ? pickName(mode.item, lang) : t('block.titleCombined', { subject: subjectName(mode.subjectId) });
  const extraSelected = classIds.filter((id) => id !== baseClassId && !chips.some((c) => c.id === id)).map((id) => findClass(id)).filter((c): c is SchoolClass => !!c);
  const chipClasses = [...chips, ...extraSelected];

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      subtitle={t('block.subtitle', { day: tc(`days.long.${day}`), n: period })}
      width={620}
      footer={
        <>
          {entry && !readOnly && (
            <Button variant="danger" className="mr-auto" disabled={busy} onClick={onRemove}>
              {t('block.remove')}
            </Button>
          )}
          {!readOnly && (
            <Button variant="primary" disabled={busy || blocked || tooFew} onClick={onSave}>
              {t('block.save')}
            </Button>
          )}
        </>
      }
    >
      <div className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t('block.classes')}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span
          aria-label={t('block.baseClass', { name: base.name })}
          className="inline-flex h-8 items-center rounded-full bg-brand px-3 text-[13px] font-semibold text-on-brand"
        >
          {base.name}
        </span>
        {chipClasses.map((c) => {
          const on = classIds.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              disabled={readOnly}
              onClick={() => toggle(c.id)}
              className={cx(
                'inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold disabled:cursor-not-allowed',
                on ? 'border-brand bg-brand/10 text-brand' : 'border-line-strong bg-white text-ink-soft hover:bg-slate-50',
              )}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-muted">{t('block.classesHint')}</p>
      {tooFew && <p className="mt-1 text-xs font-semibold text-danger">{t('block.needTwo')}</p>}

      <div className="mt-5 flex flex-col gap-4">
        {optionIds.map((id, i) => {
          const s = statuses[id];
          const unavailable = (s?.unavailable ?? []).filter((o) => teachesAtAll(o, id) || o.teacher.id === teachers[id]);
          const p = problems[i];
          const selectId = `block-teacher-${id}`;
          const teacherOptions: SelectOption[] = [
            { value: '', label: t('block.teacherPlaceholder') },
            ...(s?.available ?? []).map((o) => ({ value: o.teacher.id, label: optionLabel(o), group: t('block.available') })),
            ...unavailable.map((o) => ({
              value: o.teacher.id,
              label: optionLabel(o),
              group: t('block.unavailable'),
              disabled: o.reason !== 'limit',
            })),
          ];
          const note =
            p && 'missing' in p ? (
              <span className="inline-flex rounded-full bg-[#FBEAC9] px-2 py-0.5 text-xs font-semibold text-[#7A5A12]">{t('block.noTeacher')}</span>
            ) : (
              <>
                {p?.hard && <p className="text-xs font-semibold text-danger">{reasonText(p.hard)}</p>}
                {p?.limit && <p className="text-xs font-semibold text-[#7A5A12]">{limitWarning(t, p.limit.loadToday, p.limit.teacher.maxPerDay)}</p>}
                {p?.duplicate && <p className="text-xs font-semibold text-danger">{t('block.duplicate')}</p>}
              </>
            );
          return (
            <div key={id}>
              <label htmlFor={selectId} className="mb-1.5 block text-sm font-bold text-ink">
                {subjectName(id)}
              </label>
              <Select
                id={selectId}
                disabled={readOnly}
                value={teachers[id] ?? ''}
                onChange={(v) => setTeachers((m) => ({ ...m, [id]: v || null }))}
                options={teacherOptions}
              />
              <div className="mt-1.5 flex flex-col gap-1">{note}</div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
