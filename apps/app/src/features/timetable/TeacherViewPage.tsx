// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  bestOverlapPeriod,
  entryWindow,
  periodsFor,
  pickName,
  teacherDisplayName,
  rowsFor,
  teacherDayLoad,
  windowOf,
  type DayIndex,
  type Entry,
  type PeriodTemplate,
  type SchoolContext,
  type Subject,
  type Teacher,
  type TemplateRow,
} from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { Combobox } from '../../ui/Combobox';
import { cx } from '../../ui/cx';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { LoadingState } from '../../ui/LoadingState';
import { Modal } from '../../ui/Modal';
import { BlockEditor } from './BlockEditor';
import { blockKey, blockStateFor, isBlock, type BlockState } from './blockState';
import type { CellView } from './Cell';
import { classNames } from './labels';
import { useAdminBase } from './paths';
import { PinHeader, PinSection } from './PinPanel';
import { pinOverlayCell } from './pinOverlay';
import { TeacherAssignPicker } from './TeacherAssignPicker';
import { TeacherSlotPicker } from './TeacherSlotPicker';
import { TimetableGrid, type GridOverlay, type Slot } from './TimetableGrid';
import { usePinExit } from './usePinExit';
import { usePinMode } from './usePinMode';
import { useTimetable } from './useTimetable';

const DAYS: DayIndex[] = [0, 1, 2, 3, 4];

export function sortedTeachers(ctx: SchoolContext): Teacher[] {
  return [...ctx.teachers].sort((a, b) => teacherDisplayName(a).localeCompare(teacherDisplayName(b)));
}

function NoTeachers() {
  const { t } = useTranslation('timetable');
  return <EmptyState icon="teacherView" title={t('teacherView.noTeachersTitle')} body={t('teacherView.noTeachersBody')} />;
}

export function TeacherIndexRedirect() {
  const ctx = useSchool();
  const base = useAdminBase();
  if (ctx.loading) return <LoadingState />;
  const first = sortedTeachers(ctx)[0];
  if (!first) return <NoTeachers />;
  return <Navigate to={`${base}/timetable/teacher/${first.id}`} replace />;
}

export function TeacherViewPage() {
  const { t } = useTranslation('timetable');
  const { teacherId } = useParams();
  const ctx = useSchool();
  const year = useYear();
  const teachers = useMemo(() => sortedTeachers(ctx), [ctx]);
  if (ctx.loading || year.loading) return <LoadingState />;
  if (teachers.length === 0) return <NoTeachers />;
  const teacher = teachers.find((x) => x.id === teacherId);
  if (!teacher) return <EmptyState icon="teacherView" title={t('teacherView.notFoundTitle')} body={t('teacherView.notFoundBody')} />;
  const template = ctx.templates.find((x) => x.isDefault);
  if (!template) return <EmptyState icon="teacherView" title={t('teacherView.noDefaultTitle')} body={t('teacherView.noDefaultBody')} />;
  return <TeacherView key={teacher.id} teacher={teacher} teachers={teachers} template={template} />;
}

function gradeRange(grades: number[]): string {
  const g = [...grades].sort((a, b) => a - b);
  const contiguous = g.every((n, i) => i === 0 || n === g[i - 1]! + 1);
  return contiguous && g.length > 2 ? `${g[0]} – ${g[g.length - 1]}` : g.join(', ');
}

function entryTime(e: Entry, ctx: SchoolContext): { start: string; end: string } | undefined {
  const cls = ctx.classes.find((c) => c.id === e.classIds[0]);
  const tpl = cls && ctx.templates.find((x) => x.id === cls.templateId);
  return tpl && periodsFor(tpl, e.day).find((p) => p.period === e.period);
}

interface Placed {
  entry: Entry;
  row: number;
}

function TeacherView({ teacher, teachers, template }: { teacher: Teacher; teachers: Teacher[]; template: PeriodTemplate }) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const readOnly = useReadOnly();
  const navigate = useNavigate();
  const base = useAdminBase();
  const { yearId } = useYear();
  const { ctx, entries, save, remove } = useTimetable();

  const [selected, setSelected] = useState<Slot | undefined>();
  const [picker, setPicker] = useState<{ day: DayIndex; period: number; editing: Entry } | null>(null);
  const [assign, setAssign] = useState<{ day: DayIndex; row: number } | null>(null);
  const [block, setBlock] = useState<BlockState | null>(null);
  const [chooser, setChooser] = useState<{ day: DayIndex; period: number; list: Entry[] } | null>(null);
  const pin = usePinMode({ ctx, entries, save, remove, view: { kind: 'teacher', teacherId: teacher.id } });
  const { target: pinTarget, stop: stopPin } = pin;
  const pinOrigin = usePinExit(pinTarget, stopPin);

  const rows = useMemo(() => Object.fromEntries(DAYS.map((d) => [d, rowsFor(template, d)])) as Record<DayIndex, TemplateRow[]>, [template]);
  const mine = useMemo(() => entries.filter((e) => e.lessons.some((l) => l.teacherId === teacher.id)), [entries, teacher.id]);
  const { bySlot, outside } = useMemo(() => {
    const bySlot = new Map<string, Entry[]>();
    const outside: Entry[] = [];
    for (const e of mine) {
      const w = entryWindow(e, ctx);
      const row = w ? bestOverlapPeriod(template, e.day, w) : null;
      if (row === null) {
        outside.push(e);
        continue;
      }
      const key = `${e.day}-${row}`;
      bySlot.set(key, [...(bySlot.get(key) ?? []), e]);
    }
    for (const list of bySlot.values()) list.sort((a, b) => (entryWindow(a, ctx)?.start ?? 0) - (entryWindow(b, ctx)?.start ?? 0));
    outside.sort((a, b) => a.day - b.day || a.period - b.period);
    return { bySlot, outside };
  }, [mine, ctx, template]);
  const at = (day: DayIndex, period: number) => bySlot.get(`${day}-${period}`) ?? [];

  const index = teachers.findIndex((x) => x.id === teacher.id);
  const go = (x: Teacher | undefined) => x && navigate(`${base}/timetable/teacher/${x.id}`);

  const subjectOf = (e: Entry) => {
    const id = (e.lessons.find((l) => l.teacherId === teacher.id) ?? e.lessons[0])?.subjectId;
    const s = ctx.subjects.find((x) => x.id === id);
    return { name: s ? pickName(s, lang) : (id ?? ''), color: s?.color ?? '#E9E9E9' };
  };

  function cellView(e: Entry, row: number): CellView {
    const { name, color } = subjectOf(e);
    const classes = classNames(ctx, e.classIds);
    const time = entryTime(e, ctx);
    const rowWindow = windowOf(template, e.day, row);
    const w = entryWindow(e, ctx);
    const same = !!w && !!rowWindow && w.start === rowWindow.start && w.end === rowWindow.end;
    return {
      title: isBlock(e) ? t('cell.joined', { classes }) : classes,
      sub: same || !time ? name : t('teacherView.cellTime', { subject: name, time: `${time.start}–${time.end}` }),
      color,
      isGroup: isBlock(e),
    };
  }

  function openEntry({ entry: e, row }: Placed) {
    if (isBlock(e)) setBlock(blockStateFor(e, ctx));
    else setPicker({ day: e.day, period: row, editing: e });
  }

  function onActivate(day: DayIndex, period: number) {
    if (readOnly || windowOf(template, day, period) === null) return;
    if (pinTarget) {
      void pin.toggle(day, period);
      return;
    }
    const list = at(day, period);
    if (list.length === 0) {
      pinOrigin.current = { day, period };
      setAssign({ day, row: period });
    }
    else if (list.length === 1) openEntry({ entry: list[0]!, row: period });
    else setChooser({ day, period, list });
  }

  function onClear(day: DayIndex, period: number) {
    if (readOnly) return;
    if (pinTarget) {
      if (pin.cellAt(day, period)?.kind === 'pinned') void pin.toggle(day, period);
      return;
    }
    const list = at(day, period);
    if (list.length > 1) setChooser({ day, period, list });
    else if (list[0] && list[0].classIds.length > 1) setBlock(blockStateFor(list[0], ctx));
    else if (list[0]) void remove(list[0].id);
  }

  function pinOverlay(day: DayIndex, row: number): GridOverlay | null {
    const time = periodsFor(template, day).find((p) => p.period === row);
    const cell = pin.cellAt(day, row);
    if (!pin.names || !pinTarget || !time) return null;
    const base = ctx.classes.find((c) => c.id === pinTarget.classIds[0]);
    const period = pin.periodAt(day, row);
    const baseTpl = base && ctx.templates.find((x) => x.id === base.templateId);
    const classTime = cell?.kind === 'free' && period !== null && baseTpl ? periodsFor(baseTpl, day).find((p) => p.period === period) : undefined;
    const classNote =
      base && classTime && period !== null && (classTime.start !== time.start || classTime.end !== time.end)
        ? t('teacherAssign.classPeriod', { class: base.name, n: period, time: `${classTime.start}–${classTime.end}` })
        : undefined;
    return pinOverlayCell({
      cell,
      day,
      n: row,
      time: `${time.start}–${time.end}`,
      ctx,
      lang,
      t,
      tc,
      names: pin.names,
      progress: pin.progress,
      suggested: pin.isSuggested(day, row),
      group: pinTarget.groupKey !== undefined,
      teacherView: true,
      ...(classNote ? { classNote } : {}),
      entryView: (e) => cellView(e, row),
    });
  }

  function print() {
    window.open(`${base}/print/teacher/${teacher.id}?year=${encodeURIComponent(yearId)}&auto=1`, '_blank', 'noopener');
  }

  function loadBar(d: DayIndex) {
    const load = teacherDayLoad(teacher.id, d, entries);
    const max = teacher.maxPerDay;
    const over = load > max;
    const value = t('teacherView.loadValue', { load, max });
    return (
      <div
        role="meter"
        aria-label={t('teacherView.load', { day: tc(`days.long.${d}`) })}
        aria-valuemin={0}
        aria-valuemax={Math.max(max, load)}
        aria-valuenow={load}
        aria-valuetext={value}
        data-over={String(over)}
        className="mt-1.5 flex w-[70%] flex-col items-center gap-0.5"
      >
        <span className="block h-[5px] w-full overflow-hidden rounded-full bg-[#EEF0F3]">
          <span
            className="block h-[5px]"
            style={{ width: `${max > 0 ? Math.min(100, Math.round((load / max) * 100)) : 100}%`, background: over ? '#B4441C' : 'var(--brand)' }}
          />
        </span>
        <span className={cx('text-[11px] font-bold', over ? 'text-[#B4441C]' : 'text-ink-muted')}>{value}</span>
      </div>
    );
  }

  const subjectsLabel = teacher.isPrimary
    ? t('teacherView.primary')
    : teacher.subjectIds
        .map((id) => ctx.subjects.find((s) => s.id === id))
        .filter((s): s is Subject => !!s)
        .map((s) => pickName(s, lang))
        .join(', ');
  const gradesLabel = teacher.grades.length === 1 ? t('teacherView.grade', { grades: teacher.grades[0] }) : t('teacherView.grades', { grades: gradeRange(teacher.grades) });
  const summary = [subjectsLabel, teacher.grades.length ? gradesLabel : '', t('teacherView.max', { max: teacher.maxPerDay }), t('teacherView.week', { count: mine.length })]
    .filter(Boolean)
    .join(' · ');

  const teacherLabel = (x: Teacher) => t('teacherView.teacherOption', { name: teacherDisplayName(x, lang), staffId: x.staffId });
  const navBtn = 'flex h-10 w-10 items-center justify-center rounded-lg border border-line-strong bg-white text-ink-soft hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
  const describe = (e: Entry) => {
    const time = entryTime(e, ctx);
    return t('teacherView.outsideItem', {
      day: tc(`days.long.${e.day}`),
      classes: classNames(ctx, e.classIds),
      subject: subjectOf(e).name,
      time: time ? `${time.start}–${time.end}` : '',
    });
  };

  return (
    <div>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" aria-label={t('teacherView.prev')} className={navBtn} disabled={index <= 0} onClick={() => go(teachers[index - 1])}>
            <Icon name="chevronLeft" size={16} />
          </button>
          <label htmlFor="teacher-view-select" className="sr-only">
            {t('teacherView.teacherLabel')}
          </label>
          <div className="w-72">
            <Combobox<Teacher>
              id="teacher-view-select"
              items={teachers}
              getKey={(x) => x.id}
              getLabel={teacherLabel}
              value={teacher}
              onChange={(x) => go(x)}
              placeholder={t('teacherView.teacherLabel')}
              searchPlaceholder={t('teacherView.teacherSearch')}
            />
          </div>
          <button
            type="button"
            aria-label={t('teacherView.next')}
            className={navBtn}
            disabled={index >= teachers.length - 1}
            onClick={() => go(teachers[index + 1])}
          >
            <Icon name="chevronRight" size={16} />
          </button>
          <span className="ml-1.5 text-sm text-ink-muted">{summary}</span>
        </div>
        <Button onClick={print}>
          <Icon name="print" size={16} />
          {t('teacherView.print')}
        </Button>
      </div>

      <PinHeader pin={pin} hint={t('teacherView.pinHint')} readOnly={readOnly} />

      <PinSection
        pin={pin}
        teacher={teacherDisplayName(teacher, lang)}
        teacherRows
        footer={
          <>
            <p className="mb-0 mt-3 text-xs text-ink-muted">{t('teacherView.hint')}</p>
            {outside.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <h3 className="m-0 text-sm font-bold text-ink">{t('teacherView.outside')}</h3>
                <p className="mb-1.5 mt-0.5 text-xs text-ink-muted">{t('teacherView.outsideHint')}</p>
                <ul className="m-0 list-disc pl-5 text-sm text-ink-soft">
                  {outside.map((e) => (
                    <li key={e.id}>{describe(e)}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        }
      >
        <TimetableGrid
          rows={rows}
          cellsFor={(d, p) => {
            const list = at(d, p);
            return list.length ? list.map((e) => cellView(e, p)) : null;
          }}
          selected={selected}
          onSelect={(day, period) => setSelected({ day, period })}
          onActivate={onActivate}
          onClear={onClear}
          readOnly={readOnly}
          headerExtra={loadBar}
          overlay={pinTarget ? pinOverlay : undefined}
          activateOnClick={!!pinTarget}
        />
      </PinSection>

      {assign && (
        <TeacherAssignPicker teacherId={teacher.id} slot={assign} entries={entries} onClose={() => setAssign(null)} onSave={save} onPin={pin.start} />
      )}

      {picker && (
        <TeacherSlotPicker
          open
          onClose={() => setPicker(null)}
          teacherId={teacher.id}
          day={picker.day}
          period={picker.period}
          entries={entries}
          editing={picker.editing}
          onSave={save}
          onClear={remove}
          onGroup={({ classId, period, subjectId, item }) => {
            const editing = picker.editing;
            setPicker(null);
            setBlock({
              baseClassId: classId,
              day: picker.day,
              period,
              mode: { kind: 'group', item },
              preset: { subjectId, teacherId: teacher.id },
              ...(editing.classIds[0] === classId && editing.period === period ? { entry: editing } : { replacesEntryId: editing.id }),
            });
          }}
        />
      )}

      {block && <BlockEditor key={blockKey(block)} open onClose={() => setBlock(null)} entries={entries} onSave={save} onRemove={remove} {...block} />}

      {chooser && !readOnly && (
        <Modal
          open
          title={t('teacherView.chooseTitle')}
          subtitle={t('picker.slot', {
            day: tc(`days.long.${chooser.day}`),
            n: chooser.period,
            time: (() => {
              const w = periodsFor(template, chooser.day).find((p) => p.period === chooser.period);
              return w ? `${w.start}–${w.end}` : '';
            })(),
          })}
          onClose={() => setChooser(null)}
          width={420}
        >
          <p className="mb-3 mt-0 text-sm text-ink-soft">{t('teacherView.chooseBody')}</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {chooser.list.map((e) => {
              const v = cellView(e, chooser.period);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChooser(null);
                      openEntry({ entry: e, row: chooser.period });
                    }}
                    className="flex w-full flex-col items-start gap-0.5 rounded-[10px] border border-line-strong px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    style={{ background: v.color }}
                  >
                    <strong className="text-sm">{v.title}</strong>
                    <span className="text-xs">{v.sub}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Modal>
      )}
    </div>
  );
}
