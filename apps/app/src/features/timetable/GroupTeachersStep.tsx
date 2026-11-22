// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  blockMates,
  classProgress,
  effectivePlan,
  latestGroupSpec,
  pickName,
  pinSlots,
  planKey,
  preferredTeacherFor,
  teacherDisplayName,
  teacherOptionsForSlot,
  teachesSubject,
  type DayIndex,
  type Entry,
  type PinSpec,
  type Teacher,
} from '@sathiya/core';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { Button } from '../../ui/Button';
import { isComposing } from '../../ui/composing';
import { cx } from '../../ui/cx';
import { Icon } from '../../ui/Icon';
import { blockerText, classNames } from './conflictLabel';
import { limitWarning, planItemColor, teacherReason } from './labels';
import { initials, type GroupItem } from './pickerData';

export interface GroupTeachersStepProps {
  classId: string;
  item: GroupItem;
  slot: { day: DayIndex; period: number } | null;
  entries: Entry[];
  lockedSubjectId?: string;
  lockedTeacherId?: string;
  initialClassIds?: string[];
  classPeriods?: boolean;
  onBack?(): void;
  back?: { text: string; label: string };
  onConfirm(spec: PinSpec, placeNow: boolean): void | Promise<unknown>;
  children?(parts: { body: ReactNode; footer: ReactNode }): ReactNode;
}

interface Candidate {
  teacher: Teacher;
  preferred: boolean;
  ok: boolean;
  warn: boolean;
  note: string;
}

const inputClass =
  'box-border h-10 w-full rounded-[10px] border border-line-strong px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';
const capClass = 'm-0 text-[11px] font-bold uppercase tracking-[.06em] text-ink-muted';
const chipClass = 'rounded-full bg-brand/10 px-[7px] py-0.5 text-[11px] font-bold text-brand';

export function GroupTeachersStep(props: GroupTeachersStepProps) {
  const { classId, item, slot, entries, lockedSubjectId, lockedTeacherId, initialClassIds, classPeriods, onBack, back, onConfirm, children } = props;
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const ctx = useSchool();
  const baseId = useId();
  const cls = ctx.classes.find((c) => c.id === classId);
  const grade = cls && ctx.grades.find((g) => g.id === cls.gradeId);
  const options = item.optionSubjectIds;

  const preferred = useMemo(
    () => new Map(options.map((s) => [s, preferredTeacherFor({ entries, classId, subjectId: s })])),
    [options, entries, classId],
  );
  const mates = useMemo(() => blockMates({ ctx, baseClassId: classId, item: { groupKey: item.key } }), [ctx, classId, item.key]);

  const [picked, setPicked] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(options.map((s) => [s, s === lockedSubjectId ? (lockedTeacherId ?? null) : (preferred.get(s) ?? null)])),
  );
  const [classIds, setClassIds] = useState<string[]>(() => {
    const init = initialClassIds ?? latestGroupSpec({ ctx, entries, classId, groupKey: item.key })?.classIds ?? [classId];
    return [classId, ...mates.filter((m) => init.includes(m.id)).map((m) => m.id)];
  });
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const inputRef = useRef<HTMLInputElement>(null);
  const returnTo = useRef<string | null>(null);

  useEffect(() => {
    const first = options.find((s) => s !== lockedSubjectId);
    if (first) rowRefs.current.get(first)?.focus();
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      return;
    }
    const back = returnTo.current;
    returnTo.current = null;
    if (back) rowRefs.current.get(back)?.focus();
  }, [open]);

  useEffect(() => {
    const id = inputRef.current?.getAttribute('aria-activedescendant');
    if (id) document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' });
  });

  const slotOptions = useMemo(
    () => (slot ? new Map(options.map((s) => [s, teacherOptionsForSlot({ ctx, entries, classIds, day: slot.day, period: slot.period, subjectId: s })])) : null),
    [slot, options, ctx, entries, classIds],
  );

  if (!cls || !grade) return null;

  const classesLabel = classNames(ctx, classIds);
  const day = slot ? tc(`days.short.${slot.day}`) : '';
  const where = slot ? { day: classPeriods ? t('assign.dayOfClass', { day, class: cls.name }) : day, n: slot.period } : null;
  const subjectName = (id: string) => {
    const s = ctx.subjects.find((x) => x.id === id);
    return s ? pickName(s, lang) : id;
  };
  const teacherName = (id: string | null) => {
    const x = id ? ctx.teachers.find((y) => y.id === id) : undefined;
    return x ? teacherDisplayName(x, lang) : '';
  };

  function stateOf(subjectId: string, teacher: Teacher): Pick<Candidate, 'ok' | 'warn' | 'note'> {
    const found = slotOptions?.get(subjectId);
    if (found && slot && where) {
      const free = found.available.find((o) => o.teacher.id === teacher.id);
      if (free) return { ok: true, warn: false, note: t('assign.slotFree', { staffId: teacher.staffId, ...where, load: free.loadToday, max: teacher.maxPerDay }) };
      const o = found.unavailable.find((x) => x.teacher.id === teacher.id);
      if (o?.reason === 'limit') return { ok: true, warn: true, note: t('assign.note', { staffId: teacher.staffId, reason: limitWarning(t, o.loadToday, teacher.maxPerDay) }) };
      const reason = o ? teacherReason(t, o, ctx, lang, grade!.number) : '';
      return { ok: false, warn: true, note: t('assign.slotBusy', { staffId: teacher.staffId, ...where, reason }) };
    }
    const spec = { classIds, lessons: [{ subjectId, teacherId: teacher.id }], groupKey: item.key };
    const count = pinSlots({ ctx, entries, spec }).filter((s) => s.cell.kind === 'free' && !s.cell.limit).length;
    const note = count > 0 ? t('assign.weekFree', { staffId: teacher.staffId, count, class: classesLabel }) : t('assign.weekNone', { staffId: teacher.staffId, class: classesLabel });
    return { ok: count > 0, warn: count === 0, note };
  }

  function candidatesFor(subjectId: string): Candidate[] {
    const pref = preferred.get(subjectId);
    const list = ctx.teachers
      .filter((x) => teachesSubject(x, subjectId, grade!.number))
      .map((teacher) => ({ teacher, preferred: teacher.id === pref, ...stateOf(subjectId, teacher) }));
    return [...list.filter((c) => c.preferred), ...list.filter((c) => !c.preferred && c.ok), ...list.filter((c) => !c.preferred && !c.ok)];
  }

  const chosenIds = options.map((s) => picked[s]).filter((x): x is string => !!x);
  const dupIds = new Set(chosenIds.filter((id, i) => chosenIds.indexOf(id) !== i));
  const missing = options.filter((s) => !picked[s]);
  const spec: PinSpec | null =
    missing.length === 0 ? { classIds, lessons: options.map((s) => ({ subjectId: s, teacherId: picked[s]! })), groupKey: item.key } : null;
  const teacherCount = new Set(chosenIds).size;

  let note = '';
  let tone: 'ok' | 'need' | 'bad' = 'ok';
  let label = slot ? t('picker.assign') : t('assign.start');
  let placeNow = false;
  if (missing.length > 0) {
    note = t('assign.groupMissing', { options: missing.map(subjectName).join(', ') });
    tone = 'need';
  } else if (dupIds.size > 0) {
    note = t('assign.groupDuplicate');
    tone = 'bad';
  } else if (slot && where && spec) {
    const cell = pinSlots({ ctx, entries, spec }).find((s) => s.day === slot.day && s.period === slot.period)?.cell;
    if (cell?.kind === 'free') {
      note = t('assign.groupFree', { count: teacherCount, classes: classesLabel, ...where });
      placeNow = true;
    } else {
      note =
        cell?.kind === 'busy'
          ? t('assign.groupBlocked', { reasons: cell.blockers.map((b) => blockerText(t, b, ctx, lang)).join('; '), ...where })
          : t('assign.groupNotFree', { classes: classesLabel, ...where });
      tone = 'bad';
      label = t('assign.pinOther');
    }
  } else {
    note = t('assign.groupWeek', { count: teacherCount, classes: classesLabel });
  }
  const disabled = !spec || dupIds.size > 0 || pending;

  async function confirm() {
    if (!spec || disabled) return;
    const result = onConfirm(spec, placeNow);
    if (!(result instanceof Promise)) return;
    setPending(true);
    try {
      await result;
    } finally {
      setPending(false);
    }
  }

  function toggle(subjectId: string) {
    if (open === subjectId) {
      returnTo.current = subjectId;
      setOpen(null);
      return;
    }
    const list = candidatesFor(subjectId);
    setOpen(subjectId);
    setQuery('');
    setActive(Math.max(0, list.findIndex((c) => c.teacher.id === picked[subjectId])));
  }

  function pick(subjectId: string, teacherId: string) {
    setPicked((p) => ({ ...p, [subjectId]: teacherId }));
    returnTo.current = subjectId;
    setOpen(null);
  }

  function toggleMate(id: string) {
    setClassIds((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [classId, ...mates.filter((m) => m.id === id || cur.includes(m.id)).map((m) => m.id)]));
  }

  const plan = effectivePlan(cls, grade);
  const progress = classProgress(classId, entries, plan).find((r) => r.key === planKey(item));
  const need = progress
    ? progress.placed < progress.needed
      ? t('picker.needs', { count: progress.needed - progress.placed })
      : t('picker.done', { placed: progress.placed, needed: progress.needed })
    : '';
  const groupName = pickName(item, lang);

  const headerBody = (
    <>
      <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: planItemColor(item, ctx) }} />
      <b className="flex-1">
        {groupName} <span className="text-xs font-medium text-ink-muted">· {t('assign.groupMeta', { options: t('assign.optionCount', { count: options.length }), need })}</span>
      </b>
      {onBack && <span className="text-xs font-semibold text-brand">{back?.text ?? t('assign.back')}</span>}
    </>
  );
  const headerClass = 'flex min-h-[42px] w-full items-center gap-2.5 rounded-[10px] border border-line-strong bg-white px-3 text-left text-sm text-ink';

  function optionRow(subjectId: string) {
    const name = subjectName(subjectId);
    const chosen = picked[subjectId] ?? null;
    const chosenName = teacherName(chosen);
    const isPref = !!chosen && chosen === preferred.get(subjectId);
    const prefChip = (
      <span className={chipClass}>
        <span aria-hidden="true">★ </span>
        {t('picker.teaches', { class: cls!.name, subject: name })}
      </span>
    );

    if (subjectId === lockedSubjectId) {
      return (
        <li key={subjectId} className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-line bg-[#F6F7F9] px-3 py-1.5 text-sm text-ink">
          <b className="w-[104px] shrink-0">{name}</b>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <span className="font-semibold">{chosenName}</span>
            <span className={chipClass}>{t('assign.thisTeacher')}</span>
          </span>
        </li>
      );
    }

    const isOpen = open === subjectId;
    const dup = !!chosen && dupIds.has(chosen);
    const state = chosen ? ctx.teachers.find((x) => x.id === chosen) : undefined;
    const ok = state ? stateOf(subjectId, state).ok : false;
    const status = dup
      ? t('assign.statusDuplicate')
      : !chosen
        ? t('assign.statusNeeded')
        : slot
          ? ok
            ? t('assign.statusFree')
            : t('assign.statusBusy')
          : t('assign.statusOk');
    const bad = dup || (!!chosen && !!slot && !ok);
    const listId = `${baseId}-${subjectId}-list`;
    const optionId = (i: number) => `${listId}-${i}`;
    const needle = isOpen ? query.trim().toLowerCase() : '';
    const shown = isOpen
      ? candidatesFor(subjectId).filter(
          (c) => !needle || teacherDisplayName(c.teacher, lang).toLowerCase().includes(needle) || c.teacher.staffId.toLowerCase().includes(needle),
        )
      : [];
    const activeIndex = Math.min(active, Math.max(0, shown.length - 1));

    function onKey(e: KeyboardEvent<HTMLInputElement>) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setActive(shown.length === 0 ? 0 : Math.max(0, Math.min(shown.length - 1, activeIndex + d)));
      } else if (e.key === 'Enter') {
        if (isComposing(e)) return;
        e.preventDefault();
        const c = shown[activeIndex];
        if (c) pick(subjectId, c.teacher.id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        returnTo.current = subjectId;
        setOpen(null);
      }
    }

    return (
      <li key={subjectId} className={cx('rounded-xl', isOpen ? 'border-[1.5px] border-brand bg-[#FFFCFD]' : 'border border-line bg-white')}>
        <button
          ref={(el) => {
            if (el) rowRefs.current.set(subjectId, el);
            else rowRefs.current.delete(subjectId);
          }}
          type="button"
          aria-expanded={isOpen}
          aria-label={t('assign.optionLabel', { subject: name, teacher: chosenName || t('assign.chooseTeacher'), status })}
          onClick={() => toggle(subjectId)}
          className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border-0 bg-transparent px-3 py-1.5 text-left text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <b className="w-[104px] shrink-0">{name}</b>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <span className={cx('font-semibold', chosen ? 'text-ink' : 'text-[#7A5410]')}>{chosenName || t('assign.chooseTeacher')}</span>
            {isPref && prefChip}
          </span>
          <span className={cx('text-xs font-bold', bad ? 'text-[#B4441C]' : chosen ? 'text-[#1F6B34]' : 'text-[#7A5410]')}>{status}</span>
          <span aria-hidden="true" className="text-ink-muted">
            {isOpen ? '▴' : '▾'}
          </span>
        </button>
        {isOpen && (
          <div className="px-3 pb-3">
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={shown.length ? optionId(activeIndex) : undefined}
              aria-label={t('assign.searchOptionTeachers', { subject: name })}
              placeholder={t('picker.teacherSearch')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              className={cx(inputClass, 'mb-2')}
            />
            {shown.length === 0 && <p className="mx-0.5 my-1 text-[13px] text-ink-muted">{t('assign.noOptionTeacher', { subject: name })}</p>}
            <ul id={listId} role="listbox" aria-label={t('assign.optionTeachers', { subject: name })} className="m-0 flex list-none flex-col gap-1.5 p-0">
              {shown.map((c, i) => {
                const on = c.teacher.id === chosen;
                return (
                  <li
                    key={c.teacher.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === activeIndex}
                    onClick={() => pick(subjectId, c.teacher.id)}
                    onMouseMove={() => i !== activeIndex && setActive(i)}
                    className={cx(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left text-ink',
                      c.ok && !c.warn ? 'border-[#CFE6D4] bg-[#F5FBF6] hover:bg-[#EAF6ED]' : 'border-[#F0DDB0] bg-[#FFF9EC] hover:bg-[#FBF0D6]',
                      i === activeIndex && 'shadow-[inset_0_0_0_2px_var(--brand)]',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
                        c.ok && !c.warn ? 'bg-[#E4F2E7] text-[#1F6B34]' : 'bg-[#FBEAC9] text-[#7A5A12]',
                      )}
                    >
                      {initials(c.teacher.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-sm">{teacherDisplayName(c.teacher, lang)}</strong>
                        {c.preferred && prefChip}
                      </span>
                      <span className={cx('mt-0.5 block text-xs', c.warn ? 'font-semibold text-[#7A5A12]' : 'text-ink-muted')}>{c.note}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={cx(
                        'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]',
                        on ? 'border-brand bg-brand text-on-brand' : 'border-line-strong bg-white text-transparent',
                      )}
                    >
                      <Icon name="check" size={14} strokeWidth={2.4} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </li>
    );
  }

  const body = (
    <>
      {onBack ? (
        <button
          type="button"
          aria-label={back?.label ?? t('assign.backLabel')}
          onClick={onBack}
          className={cx(headerClass, 'hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand')}
        >
          {headerBody}
        </button>
      ) : (
        <div className={headerClass}>{headerBody}</div>
      )}
      <p className={cx(capClass, 'mb-1 mt-4')}>{t('assign.groupTeachers')}</p>
      <p className="mb-2.5 mt-0 text-xs text-ink-muted">{t('assign.groupHint')}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">{options.map(optionRow)}</ul>
      {mates.length > 0 && (
        <>
          <p className={cx(capClass, 'mb-1.5 mt-4')}>{t('assign.classesTogether')}</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex h-8 items-center rounded-full bg-brand px-3 text-[13px] font-bold text-on-brand">
              <span aria-hidden="true">{cls.name}</span>
              <span className="sr-only">{t('assign.thisClass', { name: cls.name })}</span>
            </span>
            {mates.map((m) => {
              const on = classIds.includes(m.id);
              const busy = !!slot && entries.some((e) => e.day === slot.day && e.period === slot.period && e.classIds.includes(m.id));
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleMate(m.id)}
                  className={cx(
                    'inline-flex h-8 items-center rounded-full px-3 text-[13px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand',
                    on ? 'border-[1.5px] border-brand bg-brand/10 text-brand' : 'border-[1.5px] border-dashed border-line-strong bg-white text-ink-soft',
                  )}
                >
                  {`${on ? '✓' : '+'} ${m.name}${busy && where ? ` · ${t('assign.mateBusy', where)}` : ''}`}
                </button>
              );
            })}
          </div>
          <p className="mb-0 mt-1.5 text-xs text-ink-muted">{t('assign.classesHint', { grade: grade.number, group: groupName })}</p>
        </>
      )}
    </>
  );

  const footer = (
    <>
      <span className={cx('flex-1 text-xs font-semibold', tone === 'ok' ? 'text-[#1F6B34]' : tone === 'need' ? 'text-[#7A5410]' : 'text-[#B4441C]')}>{note}</span>
      <Button variant="primary" disabled={disabled} onClick={() => void confirm()}>
        {label}
      </Button>
    </>
  );

  if (children) return <>{children({ body, footer })}</>;
  return (
    <>
      {body}
      <div className="mt-[18px] flex items-center gap-3 border-t border-line pt-3.5">{footer}</div>
    </>
  );
}
