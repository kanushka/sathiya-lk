// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  blockMates,
  periodsFor,
  pickName,
  pinProgress,
  singleSpec,
  specDraft,
  teacherClassOptions,
  teacherDisplayName,
  teacherPinSlots,
  type DayIndex,
  type Entry,
  type EntryDraft,
  type PinSpec,
  type TeacherClassOption,
  type TeacherPinCell,
} from '@sathiya/core';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Badge } from '../../ui/Badge';
import { Button, focusRingClass } from '../../ui/Button';
import { ToggleChip } from '../../ui/Chip';
import { isComposing } from '../../ui/composing';
import { cx } from '../../ui/cx';
import { inputClass } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Modal } from '../../ui/Modal';
import { busyLabel } from './conflictLabel';
import { GroupTeachersStep } from './GroupTeachersStep';
import { placeThenPin } from './placeThenPin';
import { teacherSubjects, type GroupItem } from './pickerData';

export interface TeacherAssignPickerProps {
  teacherId: string;
  slot: { day: DayIndex; row: number };
  entries: Entry[];
  onClose(): void;
  onSave(d: EntryDraft): Promise<boolean>;
  onPin(spec: PinSpec): void;
}

interface SubjectRow {
  id: string;
  name: string;
  color: string;
  left: number;
  note: string;
}

interface ClassRow {
  option: TeacherClassOption;
  label: string;
  period: number | null;
  ok: boolean;
  note: string;
  need: string;
  needed: boolean;
}

const capClass = 'm-0 text-[11px] font-bold uppercase tracking-[.06em]';

function specFor(o: TeacherClassOption, teacherId: string): PinSpec {
  return o.item.kind === 'group'
    ? { classIds: [o.cls.id], lessons: [{ subjectId: o.subjectId, teacherId }], groupKey: o.item.key }
    : singleSpec(o.cls.id, o.subjectId, teacherId);
}

function classTime(o: TeacherClassOption, day: DayIndex, period: number) {
  const p = periodsFor(o.template, day).find((x) => x.period === period);
  return p ? { start: p.start, end: p.end, text: `${p.start}–${p.end}` } : undefined;
}

export function TeacherAssignPicker(props: TeacherAssignPickerProps) {
  const readOnly = useReadOnly();
  if (readOnly) return null;
  return <TeacherAssignPickerBody {...props} />;
}

function TeacherAssignPickerBody({ teacherId, slot, entries, onClose, onSave, onPin }: TeacherAssignPickerProps) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const ctx = useSchool();
  const baseId = useId();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [classQuery, setClassQuery] = useState('');
  const [subjectActive, setSubjectActive] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [mates, setMates] = useState<string[]>([]);
  const [groupFor, setGroupFor] = useState<ClassRow | null>(null);
  const [busy, setBusy] = useState(false);
  const subjectInput = useRef<HTMLInputElement>(null);
  const classInput = useRef<HTMLInputElement>(null);

  const teacher = ctx.teachers.find((x) => x.id === teacherId);
  const def = ctx.templates.find((x) => x.isDefault);
  const rowTime = def && periodsFor(def, slot.day).find((p) => p.period === slot.row);

  const cellFor = (spec: PinSpec) => teacherPinSlots({ ctx, entries, spec, teacherId }).find((s) => s.day === slot.day && s.row === slot.row);

  const subjects = useMemo<SubjectRow[]>(() => {
    if (!teacher) return [];
    const rows = teacherSubjects(teacher, ctx).map((s) => {
      const options = teacherClassOptions({ ctx, entries, teacherId, subjectId: s.id });
      const left = options.reduce((sum, o) => sum + pinProgress({ ctx, entries, spec: specFor(o, teacherId) }).left, 0);
      const classes = t('teacherAssign.classCount', { count: options.length });
      const note = options.length === 0 ? t('teacherAssign.noClasses') : left > 0 ? t('teacherAssign.subjectNeed', { count: left, classes }) : t('teacherAssign.subjectDone', { classes });
      return { id: s.id, name: pickName(s, lang), color: s.color, left, note };
    });
    return [...rows.filter((r) => r.left > 0), ...rows.filter((r) => r.left === 0)];
  }, [teacher, ctx, entries, teacherId, lang, t]);

  const classRows = useMemo<ClassRow[]>(() => {
    if (!subjectId) return [];
    const subject = ctx.subjects.find((s) => s.id === subjectId);
    const subjectName = subject ? pickName(subject, lang) : subjectId;
    return teacherClassOptions({ ctx, entries, teacherId, subjectId }).map((o) => {
      const spec = specFor(o, teacherId);
      const all = teacherPinSlots({ ctx, entries, spec, teacherId });
      const here = all.find((s) => s.day === slot.day && s.row === slot.row);
      const freeCount = all.filter((s) => s.cell.kind === 'free').length;
      const cell: TeacherPinCell = here?.cell ?? { kind: 'none' };
      const cls = o.cls.name;
      let slotNote: string;
      if (cell.kind === 'free' && here?.period != null) slotNote = t('teacherAssign.classPeriod', { class: cls, n: here.period, time: classTime(o, slot.day, here.period)?.text ?? '' });
      else if (cell.kind === 'busy') slotNote = t('teacherAssign.slotBusy', { reason: busyLabel(t, cell.busy, ctx, lang) });
      else if (cell.kind === 'none') slotNote = t('teacherAssign.noPeriodHere', { class: cls });
      else slotNote = t('teacherAssign.slotTaken', { class: cls });
      const progress = pinProgress({ ctx, entries, spec });
      const label = o.item.kind === 'group' ? t('teacherAssign.groupClass', { class: cls, group: pickName(o.item, lang), subject: subjectName }) : cls;
      return {
        option: o,
        label,
        period: here?.period ?? null,
        ok: cell.kind === 'free',
        note: `${slotNote} · ${t('teacherAssign.weekFree', { count: freeCount })}`,
        need: progress.left > 0 ? t('picker.needs', { count: progress.left }) : t('picker.done', { placed: progress.placed, needed: progress.needed }),
        needed: progress.left > 0,
      };
    });
  }, [subjectId, ctx, entries, teacherId, slot.day, slot.row, lang, t]);

  useEffect(() => {
    if (groupFor) return;
    (subjectId ? classInput : subjectInput).current?.focus();
  }, [subjectId, groupFor]);

  useEffect(() => {
    const id = (subjectId ? classInput : subjectInput).current?.getAttribute('aria-activedescendant');
    if (id) document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' });
  });

  if (!teacher || !rowTime) return null;

  const teacherName = teacherDisplayName(teacher, lang);
  const subject = ctx.subjects.find((s) => s.id === subjectId);
  const subjectName = subject ? pickName(subject, lang) : (subjectId ?? '');
  const subtitle = t('picker.slot', { day: tc(`days.long.${slot.day}`), n: slot.row, time: `${rowTime.start}–${rowTime.end}` });

  const q = query.trim().toLowerCase();
  const subjectOptions = subjects.filter((s) => !q || s.name.toLowerCase().includes(q));
  const subjectIndex = Math.min(subjectActive, Math.max(0, subjectOptions.length - 1));
  const cq = classQuery.trim().toLowerCase();
  const classOptions = classRows.filter((r) => !cq || r.label.toLowerCase().includes(cq));
  const selected = classRows.find((r) => r.option.cls.id === picked) ?? null;
  const classIndex = classOptions.findIndex((r) => r.option.cls.id === picked);

  const subjectListId = `${baseId}-subjects`;
  const classListId = `${baseId}-classes`;
  const subjectOptionId = (i: number) => `${subjectListId}-${i}`;
  const classOptionId = (i: number) => `${classListId}-${i}`;
  const step = (n: number, len: number, d: number) => (len === 0 ? 0 : Math.max(0, Math.min(len - 1, n + d)));

  function chooseSubject(id: string) {
    setSubjectId(id);
    setClassQuery('');
    setPicked(null);
    setMates([]);
  }

  function back() {
    setSubjectId(null);
    setQuery('');
    setSubjectActive(0);
    setPicked(null);
    setMates([]);
  }

  function pick(r: ClassRow) {
    if (r.option.cls.id !== picked) setMates([]);
    setPicked(r.option.cls.id);
  }

  function choose(r: ClassRow) {
    pick(r);
    if (r.option.item.kind === 'group') setGroupFor(r);
  }

  const mateClasses = selected && selected.option.item.kind === 'subject' ? blockMates({ ctx, baseClassId: selected.option.cls.id, item: { subjectId: selected.option.subjectId } }) : [];

  let note = t('teacherAssign.chooseClass');
  let tone: 'ok' | 'need' | 'bad' = 'need';
  let label = t('picker.assign');
  let action: (() => void | Promise<void>) | null = null;
  if (selected && selected.option.item.kind === 'group') {
    const item = selected.option.item;
    note = t('teacherAssign.footGroup', { group: pickName(item, lang) });
    tone = 'ok';
    label = t('teacherAssign.setTeachers');
    action = () => setGroupFor(selected);
  } else if (selected) {
    const o = selected.option;
    const spec: PinSpec = { classIds: [o.cls.id, ...mateClasses.filter((m) => mates.includes(m.id)).map((m) => m.id)], lessons: [{ subjectId: o.subjectId, teacherId }] };
    const here = cellFor(spec);
    const cell = here?.cell;
    const where = { day: tc(`days.short.${slot.day}`), class: o.cls.name };
    if (cell?.kind === 'free' && here?.period != null) {
      const period = here.period;
      const time = classTime(o, slot.day, period);
      const same = time && time.start === rowTime.start && time.end === rowTime.end;
      note = same
        ? t('teacherAssign.footFree', { ...where, n: period, time: time.text })
        : t('teacherAssign.footFreeRow', { ...where, n: period, time: time?.text ?? '', row: slot.row, rowTime: `${rowTime.start}–${rowTime.end}` });
      tone = 'ok';
      action = async () => {
        setBusy(true);
        const ok = await onSave(specDraft(spec, slot.day, period));
        setBusy(false);
        if (!ok) return;
        onPin(spec);
        onClose();
      };
    } else {
      if (cell?.kind === 'busy') note = t('teacherAssign.footBusy', { reasons: cell.blockers.map((b) => busyLabel(t, b, ctx, lang)).join('; ') });
      else if (!cell || cell.kind === 'none') note = t('teacherAssign.footNone', where);
      else note = t('teacherAssign.footTaken', { ...where, n: here?.period ?? '' });
      tone = 'bad';
      label = t('assign.pinOther');
      action = () => {
        onPin(spec);
        onClose();
      };
    }
  }

  function run() {
    if (!action || busy) return;
    void action();
  }

  function onSubjectKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSubjectActive(step(subjectIndex, subjectOptions.length, e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter') {
      if (isComposing(e)) return;
      e.preventDefault();
      const s = subjectOptions[subjectIndex];
      if (s) chooseSubject(s.id);
    }
  }

  function onClassKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = classIndex < 0 ? 0 : step(classIndex, classOptions.length, e.key === 'ArrowDown' ? 1 : -1);
      const r = classOptions[next];
      if (r) pick(r);
    } else if (e.key === 'Enter') {
      if (isComposing(e)) return;
      e.preventDefault();
      if (classIndex >= 0) run();
    }
  }

  function confirmGroup(spec: PinSpec, placeNow: boolean) {
    const at = placeNow && groupFor && groupFor.period !== null ? { day: slot.day, period: groupFor.period } : null;
    const done = (s: PinSpec) => {
      onPin(s);
      onClose();
    };
    return placeThenPin({ spec, at, save: onSave, done });
  }

  if (groupFor && groupFor.option.item.kind === 'group') {
    const item: GroupItem = groupFor.option.item;
    return (
      <GroupTeachersStep
        key={groupFor.option.cls.id}
        classId={groupFor.option.cls.id}
        item={item}
        slot={groupFor.period === null ? null : { day: slot.day, period: groupFor.period }}
        entries={entries}
        lockedSubjectId={groupFor.option.subjectId}
        lockedTeacherId={teacherId}
        classPeriods
        onBack={() => setGroupFor(null)}
        back={{ text: t('teacherAssign.back'), label: t('teacherAssign.backLabel') }}
        onConfirm={confirmGroup}
      >
        {({ body, footer }) => (
          <Modal open onClose={onClose} title={t('assign.groupTitle', { group: pickName(item, lang) })} subtitle={subtitle} width={560} footer={footer}>
            {body}
          </Modal>
        )}
      </GroupTeachersStep>
    );
  }

  const footer = subjectId ? (
    <>
      <span className={cx('flex-1 text-xs font-semibold', tone === 'ok' ? 'text-success' : tone === 'need' ? 'text-warning' : 'text-danger')}>{note}</span>
      <Button variant="primary" disabled={!action || busy} onClick={run}>
        {label}
      </Button>
    </>
  ) : undefined;

  return (
    <Modal open onClose={onClose} title={subjectId ? t('teacherPicker.titleClass') : t('picker.titleSubject')} subtitle={subtitle} width={540} footer={footer}>
      {!subjectId ? (
        <>
          <input
            ref={subjectInput}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls={subjectListId}
            aria-activedescendant={subjectOptions.length ? subjectOptionId(subjectIndex) : undefined}
            aria-label={t('assign.searchSubjects')}
            placeholder={t('picker.subjectSearch')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSubjectActive(0);
            }}
            onKeyDown={onSubjectKey}
            className={inputClass}
          />
          <p className={cx(capClass, 'mb-1.5 mt-3 text-ink-muted')}>{t('teacherAssign.subjectsCap', { teacher: teacherName })}</p>
          {subjectOptions.length === 0 && <p className="mx-0.5 my-2 text-[13px] text-ink-muted">{t('assign.noSubjectMatch', { q: query.trim() })}</p>}
          <ul id={subjectListId} role="listbox" aria-label={t('assign.subjects')} className="m-0 flex max-h-[360px] list-none flex-col gap-0.5 overflow-y-auto p-0">
            {subjectOptions.map((s, i) => (
              <li
                key={s.id}
                id={subjectOptionId(i)}
                role="option"
                aria-selected={i === subjectIndex}
                onClick={() => chooseSubject(s.id)}
                onMouseMove={() => i !== subjectIndex && setSubjectActive(i)}
                className={cx(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-[9px] text-left text-sm text-ink',
                  s.left > 0 && 'bg-warning-soft/40',
                  i === subjectIndex && 'bg-warning-soft shadow-[inset_0_0_0_1.5px_var(--brand)]',
                )}
              >
                <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                <span className="flex-1 font-semibold">{s.name}</span>
                <span className={cx('text-right text-xs', s.left > 0 ? 'font-bold text-warning' : 'text-ink-muted')}>{s.note}</span>
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
            className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-line-strong bg-white px-3 text-left text-sm text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <span className="h-3 w-3 rounded-[3px]" style={{ background: subject?.color ?? '#E9E9E9' }} />
            <b className="flex-1">{subjectName}</b>
            <span className="text-xs font-semibold text-brand">{t('assign.back')}</span>
          </button>
          <p className={cx(capClass, 'mb-1.5 mt-3.5 text-ink-muted')}>{t('teacherAssign.classCap')}</p>
          <p className="mb-2 mt-0 text-xs text-ink-muted">{t('teacherAssign.classHint', { subject: subjectName })}</p>
          <input
            ref={classInput}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls={classListId}
            aria-activedescendant={classIndex >= 0 ? classOptionId(classIndex) : undefined}
            aria-label={t('teacherAssign.searchClasses')}
            placeholder={t('teacherAssign.classSearch')}
            value={classQuery}
            onChange={(e) => setClassQuery(e.target.value)}
            onKeyDown={onClassKey}
            className={cx(inputClass, 'mb-2.5')}
          />
          {classOptions.length === 0 && (
            <p className="mx-0.5 mb-2 mt-1 text-[13px] text-ink-muted">{classRows.length === 0 ? t('teacherAssign.noClasses') : t('teacherAssign.noClassMatch', { q: classQuery.trim() })}</p>
          )}
          <ul id={classListId} role="listbox" aria-label={t('teacherAssign.classes')} className="m-0 mb-1.5 flex list-none flex-col gap-1.5 p-0">
            {classOptions.map((r, i) => {
              const on = r.option.cls.id === picked;
              return (
                <li
                  key={r.option.cls.id}
                  id={classOptionId(i)}
                  role="option"
                  aria-selected={on}
                  aria-disabled={busy || undefined}
                  onClick={() => !busy && choose(r)}
                  className={cx(
                    'flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-ink',
                    focusRingClass,
                    r.ok ? 'border-success-line bg-success-soft/50 hover:bg-success-soft' : 'border-warning-line bg-warning-soft/50 hover:bg-warning-soft',
                    on && 'shadow-[inset_0_0_0_2px_var(--brand)]',
                    busy && 'opacity-60',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-1 text-xs font-extrabold',
                      r.ok ? 'bg-success-soft text-success' : 'bg-surface-3 text-ink-muted',
                    )}
                  >
                    {r.option.cls.name}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <strong className="text-sm">{r.label}</strong>
                      {r.option.preferred && (
                        <Badge tone="brand">
                          <span aria-hidden="true">★ </span>
                          {t('picker.teaches', { class: r.option.cls.name, subject: subjectName })}
                        </Badge>
                      )}
                      {!r.option.template.isDefault && (
                        <Badge>{t('teacherAssign.template', { template: r.option.template.name })}</Badge>
                      )}
                    </span>
                    <span className={cx('mt-0.5 block text-xs', r.ok ? 'text-ink-muted' : 'font-semibold text-warning')}>{r.note}</span>
                  </span>
                  <span className={cx('text-right text-xs', r.needed ? 'font-bold text-warning' : 'text-ink-muted')}>{r.need}</span>
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
          {selected && mateClasses.length > 0 && (
            <>
              <p className={cx(capClass, 'mb-1.5 mt-4 text-ink-muted')}>{t('teacherAssign.together')}</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex h-8 items-center rounded-full bg-brand px-3 text-[13px] font-bold text-on-brand">
                  <span aria-hidden="true">{selected.option.cls.name}</span>
                  <span className="sr-only">{t('assign.thisClass', { name: selected.option.cls.name })}</span>
                </span>
                {mateClasses.map((m) => {
                  const on = mates.includes(m.id);
                  return (
                    <ToggleChip key={m.id} pressed={on} onToggle={() => setMates((cur) => (on ? cur.filter((x) => x !== m.id) : [...cur, m.id]))}>
                      {`${on ? '✓' : '+'} ${m.name}`}
                    </ToggleChip>
                  );
                })}
              </div>
              <p className="mb-0 mt-1.5 text-xs text-ink-muted">{t('teacherAssign.togetherHint')}</p>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
