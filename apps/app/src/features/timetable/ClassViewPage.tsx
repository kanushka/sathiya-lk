// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  effectivePlan,
  fillWithClassTeacher,
  periodsFor,
  pickName,
  rowsFor,
  teacherDisplayName,
  windowOf,
  type DayIndex,
  type Entry,
  type EntryDraft,
  type SchoolClass,
  type SchoolContext,
  type TemplateRow,
} from '@sathiya/core';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { LoadingState } from '../../ui/LoadingState';
import { Modal } from '../../ui/Modal';
import { Select } from '../../ui/Select';
import { cx } from '../../ui/cx';
import { AssignPicker } from './AssignPicker';
import { BlockEditor } from './BlockEditor';
import { blockKey, blockStateFor, isBlock, type BlockState } from './blockState';
import { CellBody } from './Cell';
import { busyLabel } from './conflictLabel';
import { classCellView } from './labels';
import { useAdminBase } from './paths';
import { PinBar } from './PinBar';
import { SlotPicker } from './SlotPicker';
import { SubjectProgress } from './SubjectProgress';
import { TimetableGrid, type GridOverlay, type Slot } from './TimetableGrid';
import { usePinMode } from './usePinMode';
import { useTimetable } from './useTimetable';

const DAYS: DayIndex[] = [0, 1, 2, 3, 4];

export function sortedClasses(ctx: SchoolContext): SchoolClass[] {
  const num = (c: SchoolClass) => ctx.grades.find((g) => g.id === c.gradeId)?.number ?? 0;
  return [...ctx.classes].sort((a, b) => num(a) - num(b) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function NoClasses() {
  const { t } = useTranslation('timetable');
  return <EmptyState icon="classView" title={t('classView.noClassesTitle')} body={t('classView.noClassesBody')} />;
}

export function ClassIndexRedirect() {
  const ctx = useSchool();
  const base = useAdminBase();
  if (ctx.loading) return <LoadingState />;
  const first = sortedClasses(ctx)[0];
  if (!first) return <NoClasses />;
  return <Navigate to={`${base}/timetable/class/${first.id}`} replace />;
}

export function ClassViewPage() {
  const { t } = useTranslation('timetable');
  const { classId } = useParams();
  const ctx = useSchool();
  const year = useYear();
  const classes = useMemo(() => sortedClasses(ctx), [ctx]);
  if (ctx.loading || year.loading) return <LoadingState />;
  if (classes.length === 0) return <NoClasses />;
  const cls = classes.find((c) => c.id === classId);
  const template = cls && ctx.templates.find((x) => x.id === cls.templateId);
  const grade = cls && ctx.grades.find((g) => g.id === cls.gradeId);
  if (!cls || !template || !grade) return <EmptyState icon="classView" title={t('classView.notFoundTitle')} body={t('classView.notFoundBody')} />;
  return <ClassView key={cls.id} cls={cls} classes={classes} />;
}

const pinCell = 'box-border border-[1.5px] border-dashed items-center px-2.5 text-center';
const pinFree = `${pinCell} border-[#2E8B4A] bg-[#F5FBF6] text-[#1F6B34]`;
const pinWarn = `${pinCell} border-[#B7831F] bg-[#FFF6E2] text-[#6B4A0E]`;
const pinOver = `${pinCell} border-[#C2410C] bg-[#FDECEA] text-[#9A3412]`;
const pinSuggested = 'items-center border-[1.5px] border-solid border-[#2E8B4A] bg-[#E4F2E7] px-2.5 text-center text-[#1F6B34]';
const pinBusy = 'border-line bg-[repeating-linear-gradient(135deg,#F1F2F5_0_6px,#E4E6EC_6px_12px)] px-2.5 text-ink-muted';

function PinGlyph({ sub }: { sub: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <Icon name="pin" size={18} strokeWidth={2} />
      <span className="text-[11px] font-semibold">{sub}</span>
    </span>
  );
}

function Swatch({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
      <i aria-hidden="true" className={cx('inline-block h-3.5 w-3.5 rounded', className)} />
      {children}
    </span>
  );
}

function ClassView({ cls, classes }: { cls: SchoolClass; classes: SchoolClass[] }) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const readOnly = useReadOnly();
  const navigate = useNavigate();
  const base = useAdminBase();
  const { yearId } = useYear();
  const { ctx, entries, save, remove } = useTimetable();
  const grade = ctx.grades.find((g) => g.id === cls.gradeId)!;
  const template = ctx.templates.find((x) => x.id === cls.templateId)!;
  const plan = effectivePlan(cls, grade);
  const classTeacher = ctx.teachers.find((x) => x.id === cls.classTeacherId);

  const [selected, setSelected] = useState<Slot | undefined>();
  const [picker, setPicker] = useState<{ day: DayIndex; period: number; editing: Entry } | null>(null);
  const [assign, setAssign] = useState<{ slot: Slot | null; subjectId?: string } | null>(null);
  const pin = usePinMode({ ctx, classId: cls.id, entries, save, remove });
  const { target: pinTarget, stop: stopPin } = pin;
  const pinOrigin = useRef<{ day: DayIndex; period: number } | { subjectId: string } | null>(null);
  const pinWasOn = useRef(false);
  const [block, setBlock] = useState<BlockState | null>(null);
  const [fill, setFill] = useState<{ drafts: EntryDraft[]; done: number; running: boolean } | null>(null);

  const rows = useMemo(() => Object.fromEntries(DAYS.map((d) => [d, rowsFor(template, d)])) as Record<DayIndex, TemplateRow[]>, [template]);
  const bySlot = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries) if (e.classIds.includes(cls.id)) m.set(`${e.day}-${e.period}`, e);
    return m;
  }, [entries, cls.id]);
  const entryAt = (day: DayIndex, period: number) => bySlot.get(`${day}-${period}`);
  const fillDrafts = useMemo(() => fillWithClassTeacher({ ctx, entries, classId: cls.id }), [ctx, entries, cls.id]);

  const index = classes.findIndex((c) => c.id === cls.id);
  const go = (c: SchoolClass | undefined) => c && navigate(`${base}/timetable/class/${c.id}`);
  const gradeNumber = (c: SchoolClass) => ctx.grades.find((g) => g.id === c.gradeId)?.number ?? '';

  useEffect(() => {
    if (pinTarget) {
      pinWasOn.current = true;
      return;
    }
    if (!pinWasOn.current) return;
    pinWasOn.current = false;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const origin = pinOrigin.current;
    const el =
      origin && 'subjectId' in origin
        ? document.querySelector<HTMLElement>(`[data-pin-subject="${origin.subjectId}"]`)
        : origin && document.querySelector<HTMLElement>(`[data-day="${origin.day}"][data-period="${origin.period}"]`);
    el?.focus();
  }, [pinTarget]);

  useEffect(() => {
    if (!pinTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('[role="dialog"]')) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return;
      stopPin();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pinTarget, stopPin]);

  function onActivate(day: DayIndex, period: number) {
    if (readOnly || windowOf(template, day, period) === null) return;
    if (pinTarget) {
      void pin.toggle(day, period);
      return;
    }
    const e = entryAt(day, period);
    if (!e) {
      pinOrigin.current = { day, period };
      setAssign({ slot: { day, period } });
    }
    else if (isBlock(e)) setBlock(blockStateFor(e, ctx, cls.id));
    else setPicker({ day, period, editing: e });
  }

  function onClear(day: DayIndex, period: number) {
    if (readOnly) return;
    if (pinTarget) {
      if (pin.cellAt(day, period)?.kind === 'pinned') void pin.toggle(day, period);
      return;
    }
    const e = entryAt(day, period);
    if (!e) return;
    if (e.classIds.length > 1) setBlock(blockStateFor(e, ctx, cls.id));
    else void remove(e.id);
  }

  const pinSubject = pinTarget && ctx.subjects.find((x) => x.id === pinTarget.subjectId);
  const pinTeacher = pinTarget && ctx.teachers.find((x) => x.id === pinTarget.teacherId);
  const pinSubjectName = pinSubject ? pickName(pinSubject, lang) : (pinTarget?.subjectId ?? '');
  const pinTeacherName = pinTeacher ? teacherDisplayName(pinTeacher, lang) : '';

  function pinOverlay(day: DayIndex, period: number): GridOverlay | null {
    const c = pinTarget && pin.cellAt(day, period);
    const time = periodsFor(template, day).find((p) => p.period === period);
    if (!c || !time) return null;
    const where = { day: tc(`days.long.${day}`), n: period, time: `${time.start}–${time.end}` };
    if (c.kind === 'taken') {
      const view = classCellView(c.entry, ctx, lang, t, plan);
      return { label: t('grid.cell', { ...where, title: `${view.title} ${view.sub}` }), className: 'border-transparent text-ink opacity-40', content: <CellBody cells={[view]} />, disabled: true };
    }
    if (c.kind === 'pinned') {
      const view = classCellView(c.entry, ctx, lang, t, plan);
      return {
        label: t('pin.cellPinned', { ...where, subject: view.title, teacher: view.sub }),
        className: 'border-transparent text-ink ring-2 ring-brand ring-offset-2',
        content: <CellBody cells={[{ ...view, sub: t('pin.clickUnpin') }]} />,
      };
    }
    if (c.kind === 'busy') {
      const reason = busyLabel(t, c.busy, ctx, lang);
      return {
        label: t('pin.cellBusy', { ...where, reason }),
        className: pinBusy,
        content: (
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold">{t('pin.busy')}</span>
            <span className="text-[11px]">{reason}</span>
          </span>
        ),
        disabled: true,
      };
    }
    const label = t('pin.cellPin', { ...where, subject: pinSubjectName, teacher: pinTeacherName });
    if (pin.progress && pin.progress.left === 0) {
      return { label: `${label}, ${t('pin.noteOver')}`, className: pinOver, content: <PinGlyph sub={t('pin.overPlan')} /> };
    }
    if (pin.isSuggested(day, period)) {
      return {
        label: `${label}, ${t('pin.noteSuggested')}`,
        className: pinSuggested,
        content: (
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold">{t('pin.suggested')}</span>
            <span className="text-[11px]">{t('pin.clickPin')}</span>
          </span>
        ),
      };
    }
    if (c.limit) {
      return { label: `${label}, ${t('pin.noteLimit', { load: c.load, max: c.max })}`, className: pinWarn, content: <PinGlyph sub={t('pin.limit', { load: c.load, max: c.max })} /> };
    }
    if (c.subjectThatDay) {
      const note = t('pin.subjectDay', { subject: pinSubjectName, day: tc(`days.short.${day}`) });
      return { label: `${label}, ${note}`, className: pinWarn, content: <PinGlyph sub={note} /> };
    }
    return { label, className: pinFree, content: <PinGlyph sub={t('pin.free')} /> };
  }

  function print() {
    window.open(`${base}/print/class/${cls.id}?year=${encodeURIComponent(yearId)}&auto=1`, '_blank', 'noopener');
  }

  async function runFill() {
    if (!fill) return;
    setFill({ ...fill, running: true });
    for (let i = 0; i < fill.drafts.length; i++) {
      const ok = await save(fill.drafts[i]!);
      if (!ok) break;
      setFill((f) => f && { ...f, done: i + 1 });
    }
    setFill(null);
  }

  const navBtn = 'flex h-10 w-10 items-center justify-center rounded-lg border border-line-strong bg-white text-ink-soft hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" aria-label={t('classView.prev')} className={navBtn} disabled={index <= 0} onClick={() => go(classes[index - 1])}>
            <Icon name="chevronLeft" size={16} />
          </button>
          <Select
            aria-label={t('classView.classLabel')}
            value={cls.id}
            onChange={(e) => go(classes.find((c) => c.id === e.target.value))}
            className="w-52 [&_select]:text-[15px] [&_select]:font-semibold"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {t('classView.classOption', { grade: gradeNumber(c), name: c.name })}
              </option>
            ))}
          </Select>
          <button type="button" aria-label={t('classView.next')} className={navBtn} disabled={index >= classes.length - 1} onClick={() => go(classes[index + 1])}>
            <Icon name="chevronRight" size={16} />
          </button>
          <span className="ml-1.5 text-sm text-ink-muted">
            {classTeacher ? (
              <>
                {t('classView.classTeacher')} <b className="text-ink">{teacherDisplayName(classTeacher, lang)}</b>
              </>
            ) : (
              t('classView.noClassTeacher')
            )}{' '}
            · {template.name}
          </span>
        </div>
        <div className="flex gap-2">
          {!readOnly && classTeacher && (
            <Button disabled={fillDrafts.length === 0} onClick={() => setFill({ drafts: fillDrafts, done: 0, running: false })}>
              {t('classView.fill')}
            </Button>
          )}
          <Button onClick={print}>
            <Icon name="print" size={16} />
            {t('classView.print')}
          </Button>
        </div>
      </div>

      {pinTarget && pin.progress ? (
        <PinBar
          subject={pinSubjectName}
          teacher={pinTeacherName}
          color={pinSubject?.color ?? '#E9E9E9'}
          progress={pin.progress}
          suggestedCount={pin.suggested.length}
          onSuggest={pin.suggest}
          onPinSuggested={() => void pin.pinSuggested()}
          onDone={stopPin}
        />
      ) : (
        !readOnly && <p className="mb-3.5 rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] text-ink-soft">{t('pin.hint')}</p>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <section
          data-pin-mode={pinTarget ? 'true' : undefined}
          className={cx(
            'min-w-0 flex-[999_1_620px] overflow-x-auto rounded-[14px] border border-line bg-white p-4',
            pinTarget && 'outline outline-2 outline-offset-2 outline-brand',
          )}
        >
          {pinTarget && (
            <div aria-label={t('pin.legendLabel')} className="mb-3 ml-1 flex flex-wrap gap-3.5">
              <Swatch className="border-[1.5px] border-dashed border-[#2E8B4A] bg-[#F5FBF6]">{t('pin.legendFree', { teacher: pinTeacherName })}</Swatch>
              <Swatch className="border-[1.5px] border-dashed border-[#B7831F] bg-[#FFF6E2]">{t('pin.legendSubjectDay')}</Swatch>
              <Swatch className="border-[1.5px] border-dashed border-[#C2410C] bg-[#FDECEA]">{t('pin.legendOver')}</Swatch>
              <Swatch className="border-[1.5px] border-[#2E8B4A] bg-[#E4F2E7]">{t('pin.legendSuggested')}</Swatch>
              <Swatch className="bg-[repeating-linear-gradient(135deg,#EEF0F3_0_4px,#DADDE4_4px_8px)]">{t('pin.legendBusy')}</Swatch>
            </div>
          )}
          <TimetableGrid
            rows={rows}
            cellsFor={(d, p) => {
              const e = entryAt(d, p);
              return e ? classCellView(e, ctx, lang, t, plan) : null;
            }}
            selected={selected}
            onSelect={(day, period) => setSelected({ day, period })}
            onActivate={onActivate}
            onClear={onClear}
            readOnly={readOnly}
            overlay={pinTarget ? pinOverlay : undefined}
            activateOnClick={!!pinTarget}
          />
          <p role="status" className="mx-1 mb-0 mt-3 min-h-[1px] text-[13px] font-semibold text-[#1F6B34] empty:mt-0">
            {pin.message}
          </p>
        </section>
        <div className="flex min-w-[280px] max-w-[360px] flex-[1_1_300px] flex-col gap-4">
          <SubjectProgress
            cls={cls}
            entries={entries}
            {...(readOnly
              ? {}
              : {
                  onPin: (subjectId: string) => {
                    if (pinTarget) stopPin();
                    pinOrigin.current = { subjectId };
                    setAssign({ slot: null, subjectId });
                  },
                  onStop: stopPin,
                  ...(pinTarget ? { activeSubjectId: pinTarget.subjectId } : {}),
                })}
          />
        </div>
      </div>

      {assign && (
        <AssignPicker
          classId={cls.id}
          slot={assign.slot}
          {...(assign.subjectId ? { subjectId: assign.subjectId } : {})}
          entries={entries}
          onClose={() => setAssign(null)}
          onSave={save}
          onPin={pin.start}
          onGroup={(item) => {
            const at = assign.slot;
            setAssign(null);
            if (at) setBlock({ baseClassId: cls.id, day: at.day, period: at.period, mode: { kind: 'group', item } });
          }}
          onCombine={(subjectId) => {
            const at = assign.slot;
            setAssign(null);
            if (at) setBlock({ baseClassId: cls.id, day: at.day, period: at.period, mode: { kind: 'combined', subjectId } });
          }}
        />
      )}

      {picker && (
        <SlotPicker
          open
          onClose={() => setPicker(null)}
          classId={cls.id}
          day={picker.day}
          period={picker.period}
          entries={entries}
          editing={picker.editing}
          onSave={save}
          onClear={remove}
          onGroup={(item) => {
            setPicker(null);
            setBlock({ baseClassId: cls.id, day: picker.day, period: picker.period, mode: { kind: 'group', item }, entry: picker.editing });
          }}
          onCombine={(subjectId) => {
            setPicker(null);
            setBlock({ baseClassId: cls.id, day: picker.day, period: picker.period, mode: { kind: 'combined', subjectId }, entry: picker.editing });
          }}
        />
      )}

      {block && <BlockEditor key={blockKey(block)} open onClose={() => setBlock(null)} entries={entries} onSave={save} onRemove={remove} {...block} />}

      {fill && classTeacher && (
        <Modal
          open
          title={t('fill.title')}
          onClose={() => !fill.running && setFill(null)}
          width={480}
          footer={
            <>
              <Button disabled={fill.running} onClick={() => setFill(null)}>
                {t('fill.cancel')}
              </Button>
              <Button variant="primary" disabled={fill.running || fill.drafts.length === 0} onClick={runFill}>
                {fill.running ? t('fill.running', { done: fill.done, count: fill.drafts.length }) : t('fill.confirm', { count: fill.drafts.length })}
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-soft">
            {fill.drafts.length > 0
              ? t('fill.body', { count: fill.drafts.length, teacher: teacherDisplayName(classTeacher, lang) })
              : t('fill.none', { teacher: teacherDisplayName(classTeacher, lang) })}
          </p>
        </Modal>
      )}
    </div>
  );
}
