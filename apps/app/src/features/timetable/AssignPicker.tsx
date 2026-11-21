// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  pickName,
  pinSlots,
  periodsFor,
  preferredTeacherFor,
  teacherDisplayName,
  teacherOptionsForSlot,
  teachesSubject,
  type DayIndex,
  type Entry,
  type EntryDraft,
  type Teacher,
} from '@sathiya/core';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { Icon } from '../../ui/Icon';
import { Modal } from '../../ui/Modal';
import { limitWarning, planItemColor, teacherReason, teachesAtAll } from './labels';
import { initials, usePickItems, type GroupItem, type PickItem } from './pickerData';

export interface PinTarget {
  subjectId: string;
  teacherId: string;
}

export interface AssignPickerProps {
  classId: string;
  slot: { day: DayIndex; period: number } | null;
  subjectId?: string;
  entries: Entry[];
  onClose(): void;
  onSave(d: EntryDraft): Promise<boolean>;
  onPin(target: PinTarget): void;
  onGroup(item: GroupItem): void;
  onCombine(subjectId: string): void;
}

interface Candidate {
  teacher: Teacher;
  selectable: boolean;
  preferred: boolean;
  note: string;
  warn: boolean;
  canPinElsewhere: boolean;
}

export function AssignPicker(props: AssignPickerProps) {
  const readOnly = useReadOnly();
  if (readOnly) return null;
  return <AssignPickerBody {...props} />;
}

const inputClass =
  'box-border h-[42px] w-full rounded-[10px] border border-line-strong px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';
const capClass = 'm-0 text-[11px] font-bold uppercase tracking-[.06em]';

function AssignPickerBody({ classId, slot, subjectId: initialSubject, entries, onClose, onSave, onPin, onGroup, onCombine }: AssignPickerProps) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const ctx = useSchool();
  const [subjectId, setSubjectId] = useState<string | null>(initialSubject ?? null);
  const [query, setQuery] = useState('');
  const [teacherQuery, setTeacherQuery] = useState('');
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const subjectInput = useRef<HTMLInputElement>(null);
  const teacherInput = useRef<HTMLInputElement>(null);

  const cls = ctx.classes.find((c) => c.id === classId);
  const grade = cls && ctx.grades.find((g) => g.id === cls.gradeId);
  const template = cls && ctx.templates.find((x) => x.id === cls.templateId);
  const time = slot && template ? periodsFor(template, slot.day).find((p) => p.period === slot.period) : undefined;
  const items = usePickItems(ctx, classId, entries, lang);

  useEffect(() => {
    (subjectId ? teacherInput : subjectInput).current?.focus();
  }, [subjectId]);

  const candidates = useMemo<Candidate[]>(() => {
    if (!subjectId || !grade) return [];
    const preferredId = preferredTeacherFor({ entries, classId, subjectId });
    const freeWeek = (teacherId: string) =>
      pinSlots({ ctx, entries, classId, subjectId, teacherId }).filter((s) => s.cell.kind === 'free' && !s.cell.limit).length;
    const out: Candidate[] = [];
    if (slot) {
      const options = teacherOptionsForSlot({ ctx, entries, classIds: [classId], day: slot.day, period: slot.period, subjectId });
      for (const o of options.available) {
        const note = t('picker.freeNote', { staffId: o.teacher.staffId, load: o.loadToday, max: o.teacher.maxPerDay, day: tc(`days.long.${slot.day}`) });
        out.push({ teacher: o.teacher, selectable: true, preferred: false, note, warn: false, canPinElsewhere: false });
      }
      for (const o of options.unavailable) {
        if (!teachesAtAll(o, subjectId)) continue;
        const limit = o.reason === 'limit';
        const reason = limit ? limitWarning(t, o.loadToday, o.teacher.maxPerDay) : teacherReason(t, o, ctx, lang, grade.number);
        out.push({
          teacher: o.teacher,
          selectable: limit,
          preferred: false,
          note: t('assign.note', { staffId: o.teacher.staffId, reason }),
          warn: limit,
          canPinElsewhere: o.reason === 'busy' && freeWeek(o.teacher.id) > 0,
        });
      }
    } else {
      for (const teacher of ctx.teachers) {
        if (!teacher.subjectIds.includes(subjectId) && !teachesSubject(teacher, subjectId, grade.number)) continue;
        if (!teachesSubject(teacher, subjectId, grade.number)) {
          const note = t('assign.note', { staffId: teacher.staffId, reason: t('block.notQualified', { grade: grade.number }) });
          out.push({ teacher, selectable: false, preferred: false, note, warn: false, canPinElsewhere: false });
          continue;
        }
        const count = freeWeek(teacher.id);
        const note = count > 0 ? t('assign.weekFree', { staffId: teacher.staffId, count, class: cls?.name }) : t('assign.weekNone', { staffId: teacher.staffId, class: cls?.name });
        out.push({ teacher, selectable: count > 0, preferred: false, note, warn: false, canPinElsewhere: false });
      }
      out.sort((a, b) => Number(b.selectable) - Number(a.selectable));
    }
    const marked = out.map((c) => ({ ...c, preferred: c.teacher.id === preferredId }));
    return [...marked.filter((c) => c.preferred), ...marked.filter((c) => !c.preferred && c.selectable), ...marked.filter((c) => !c.preferred && !c.selectable)];
  }, [subjectId, grade, entries, classId, ctx, slot, t, tc, lang, cls]);

  if (!cls || !grade || (slot && !time)) return null;

  const defaultPick = candidates.find((c) => c.preferred && c.selectable)?.teacher.id ?? null;
  const selected = picked === undefined ? defaultPick : picked;
  const subject = ctx.subjects.find((s) => s.id === subjectId);
  const subjectName = subject ? pickName(subject, lang) : (subjectId ?? '');
  const subjectColor = subject?.color ?? '#E9E9E9';

  const q = query.trim().toLowerCase();
  const subjectOptions = items.filter((p) => (slot || p.item.kind === 'subject') && (!q || p.name.toLowerCase().includes(q) || shortOf(p).includes(q)));
  function shortOf(p: PickItem): string {
    if (p.item.kind !== 'subject') return '';
    const id = p.item.subjectId;
    return ctx.subjects.find((s) => s.id === id)?.short.toLowerCase() ?? '';
  }

  const tq = teacherQuery.trim().toLowerCase();
  const shown = candidates.filter(
    (c) => !tq || teacherDisplayName(c.teacher, lang).toLowerCase().includes(tq) || c.teacher.staffId.toLowerCase().includes(tq),
  );

  function choose(p: PickItem) {
    if (p.item.kind === 'group') {
      onGroup(p.item);
      return;
    }
    setSubjectId(p.item.subjectId);
    setQuery('');
    setTeacherQuery('');
    setPicked(undefined);
  }

  function back() {
    setSubjectId(null);
    setQuery('');
    setTeacherQuery('');
    setPicked(undefined);
  }

  async function confirm(teacherId: string | null = selected) {
    if (!subjectId || !teacherId || busy) return;
    if (!slot) {
      onPin({ subjectId, teacherId });
      onClose();
      return;
    }
    setBusy(true);
    const ok = await onSave({ day: slot.day, period: slot.period, classIds: [classId], lessons: [{ subjectId, teacherId }] });
    setBusy(false);
    if (!ok) return;
    onPin({ subjectId, teacherId });
    onClose();
  }

  function onSubjectKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const top = subjectOptions[0];
    if (top) choose(top);
  }

  function onTeacherKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const top = shown.find((c) => c.selectable);
    if (!top) return;
    if (top.teacher.id === selected) void confirm(top.teacher.id);
    else setPicked(top.teacher.id);
  }

  const need = (p: PickItem) => (p.placed < p.needed ? t('picker.needs', { count: p.needed - p.placed }) : t('picker.done', { placed: p.placed, needed: p.needed }));
  const preferredName = (p: PickItem) => {
    if (p.item.kind === 'group') return t('assign.groupTag');
    const id = preferredTeacherFor({ entries, classId, subjectId: p.item.subjectId });
    return ctx.teachers.find((x) => x.id === id)?.name ?? '';
  };

  const footer = subjectId ? (
    <>
      {slot && (
        <Button className="mr-auto" disabled={busy} onClick={() => onCombine(subjectId)}>
          {t('picker.combine')}
        </Button>
      )}
      <Button variant="primary" disabled={busy || !selected} onClick={() => void confirm()}>
        {slot ? t('picker.assign') : t('assign.start')}
      </Button>
    </>
  ) : undefined;

  return (
    <Modal
      open
      onClose={onClose}
      title={subjectId ? t('picker.titleTeacher') : t('picker.titleSubject')}
      subtitle={slot && time ? t('picker.slot', { day: tc(`days.long.${slot.day}`), n: slot.period, time: `${time.start}–${time.end}` }) : t('assign.wholeWeek')}
      width={520}
      footer={footer}
    >
      {!subjectId ? (
        <>
          <input
            ref={subjectInput}
            type="search"
            aria-label={t('assign.searchSubjects')}
            placeholder={t('picker.subjectSearch')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSubjectKey}
            className={inputClass}
          />
          <p className={cx(capClass, 'mb-1.5 mt-3 text-[#7A5410]')}>{t('assign.neededFirst', { count: subjectOptions.length })}</p>
          {subjectOptions.length === 0 && <p className="mx-0.5 my-2 text-[13px] text-ink-muted">{t('assign.noSubjectMatch', { q: query.trim() })}</p>}
          <ul aria-label={t('assign.subjects')} className="m-0 flex max-h-[360px] list-none flex-col gap-0.5 overflow-y-auto p-0">
            {subjectOptions.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => choose(p)}
                  className={cx(
                    'flex w-full items-center gap-2.5 rounded-lg px-2 py-[9px] text-left text-sm text-ink hover:bg-[#FBF1DC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand',
                    p.placed < p.needed && 'bg-[#FFFCF5]',
                  )}
                >
                  <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: planItemColor(p.item, ctx) }} />
                  <span className="flex-1 font-semibold">{p.name}</span>
                  <span className="text-xs text-ink-muted">{preferredName(p)}</span>
                  <span className={cx('w-16 text-right text-xs', p.placed < p.needed ? 'font-bold text-[#7A5410]' : 'text-ink-muted')}>{need(p)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <button
            type="button"
            aria-label={t('assign.backLabel')}
            onClick={back}
            className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] border border-line-strong bg-white px-3 text-left text-sm text-ink hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span className="h-3 w-3 rounded-[3px]" style={{ background: subjectColor }} />
            <b className="flex-1">{subjectName}</b>
            <span className="text-xs font-semibold text-brand">{t('assign.back')}</span>
          </button>
          <p className={cx(capClass, 'mb-1.5 mt-3.5 text-ink-muted')}>{t('picker.teacher')}</p>
          <p className="mb-2 mt-0 text-xs text-ink-muted">{slot ? t('assign.hintSlot') : t('assign.hintWeek')}</p>
          <input
            ref={teacherInput}
            type="search"
            aria-label={t('assign.searchTeachers')}
            placeholder={t('picker.teacherSearch')}
            value={teacherQuery}
            onChange={(e) => setTeacherQuery(e.target.value)}
            onKeyDown={onTeacherKey}
            className={cx(inputClass, 'mb-2.5')}
          />
          {shown.length === 0 && <p className="mx-0.5 mb-2 mt-1 text-[13px] text-ink-muted">{t('picker.noTeacherMatch', { subject: subjectName, q: teacherQuery.trim() })}</p>}
          <ul aria-label={t('assign.teachers')} className="m-0 flex list-none flex-col gap-1.5 p-0">
            {shown.map((c) => {
              const name = teacherDisplayName(c.teacher, lang);
              const on = c.selectable && c.teacher.id === selected;
              const tag = c.preferred && (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                  <span aria-hidden="true">★ </span>
                  {t('picker.teaches', { class: cls.name, subject: subjectName })}
                </span>
              );
              const body = (
                <>
                  <span
                    aria-hidden="true"
                    className={cx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
                      c.selectable ? 'bg-[#E4F2E7] text-[#1F6B34]' : 'bg-[#E9EBF0] text-ink-muted',
                    )}
                  >
                    {initials(c.teacher.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <strong className="text-sm">{name}</strong>
                      {tag}
                    </span>
                    <span className={cx('mt-0.5 block text-xs', c.warn ? 'font-semibold text-[#7A5A12]' : 'text-ink-muted')}>{c.note}</span>
                  </span>
                </>
              );
              return (
                <li key={c.teacher.id}>
                  {c.selectable ? (
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={busy}
                      onClick={() => setPicked(c.teacher.id)}
                      onDoubleClick={() => void confirm(c.teacher.id)}
                      className={cx(
                        'flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:opacity-60',
                        c.warn ? 'border-[#F0DDB0] bg-[#FFF9EC] hover:bg-[#FBF0D6]' : 'border-[#CFE6D4] bg-[#F5FBF6] hover:bg-[#EAF6ED]',
                        on && 'shadow-[inset_0_0_0_2px_var(--brand)]',
                      )}
                    >
                      {body}
                      <span
                        aria-hidden="true"
                        className={cx(
                          'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]',
                          on ? 'border-brand bg-brand text-on-brand' : 'border-line-strong bg-white text-transparent',
                        )}
                      >
                        <Icon name="check" size={14} strokeWidth={2.4} />
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-[#F6F7F9] px-3 py-2.5 text-ink-muted">
                      {body}
                      {c.canPinElsewhere && (
                        <Button size="sm" className="shrink-0 whitespace-nowrap text-xs" onClick={() => {
                          onPin({ subjectId: subjectId, teacherId: c.teacher.id });
                          onClose();
                        }}>
                          {t('assign.useOther')}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
