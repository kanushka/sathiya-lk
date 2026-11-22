// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  effectivePlan,
  fillWithClassTeacher,
  groupSpecIsCurrent,
  latestGroupSpec,
  planKey,
  periodsFor,
  rowsFor,
  teacherDisplayName,
  windowOf,
  type DayIndex,
  type Entry,
  type EntryDraft,
  type PlanItem,
  type SchoolClass,
  type SchoolContext,
  type TemplateRow,
} from '@sathiya/core';
import { useMemo, useState } from 'react';
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
import { AssignPicker } from './AssignPicker';
import { BlockEditor } from './BlockEditor';
import { blockKey, blockStateFor, isBlock, type BlockState } from './blockState';
import { classCellView } from './labels';
import { useAdminBase } from './paths';
import { PinHeader, PinSection } from './PinPanel';
import { pinOverlayCell } from './pinOverlay';
import { SlotPicker } from './SlotPicker';
import { SubjectProgress } from './SubjectProgress';
import { TimetableGrid, type GridOverlay, type Slot } from './TimetableGrid';
import { usePinExit } from './usePinExit';
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
  const [assign, setAssign] = useState<{ slot: Slot | null; subjectId?: string; groupKey?: string } | null>(null);
  const pin = usePinMode({ ctx, entries, save, remove, view: { kind: 'class' } });
  const { target: pinTarget, stop: stopPin } = pin;
  const pinOrigin = usePinExit(pinTarget, stopPin);
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

  function pinOverlay(day: DayIndex, period: number): GridOverlay | null {
    const time = periodsFor(template, day).find((p) => p.period === period);
    if (!pin.names || !time) return null;
    return pinOverlayCell({
      cell: pin.cellAt(day, period),
      day,
      n: period,
      time: `${time.start}–${time.end}`,
      ctx,
      lang,
      t,
      tc,
      names: pin.names,
      progress: pin.progress,
      suggested: pin.isSuggested(day, period),
      group: pinTarget?.groupKey !== undefined,
      entryView: (e) => classCellView(e, ctx, lang, t, plan),
    });
  }

  function pinFromList(item: PlanItem) {
    pinOrigin.current = { key: planKey(item) };
    if (item.kind === 'group') {
      const spec = latestGroupSpec({ ctx, entries, classId: cls.id, groupKey: item.key });
      if (spec && groupSpecIsCurrent({ ctx, classId: cls.id, spec })) {
        pin.start(spec);
        return;
      }
      if (pinTarget) stopPin();
      setAssign({ slot: null, groupKey: item.key });
      return;
    }
    if (pinTarget) stopPin();
    setAssign({ slot: null, subjectId: item.subjectId });
  }

  const activePlanItem = pinTarget
    ? plan.find((p) => (p.kind === 'group' ? p.key === pinTarget.groupKey : pinTarget.groupKey === undefined && p.subjectId === pinTarget.lessons[0]?.subjectId))
    : undefined;

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

      <PinHeader pin={pin} hint={t('pin.hint')} readOnly={readOnly} />

      <div className="flex flex-wrap items-start gap-5">
        <PinSection pin={pin} teacher={pin.names?.teacher ?? ''} className="flex-[999_1_620px]">
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
        </PinSection>
        <div className="flex min-w-[280px] max-w-[360px] flex-[1_1_300px] flex-col gap-4">
          <SubjectProgress
            cls={cls}
            entries={entries}
            {...(readOnly
              ? {}
              : {
                  onPin: pinFromList,
                  onStop: stopPin,
                  ...(activePlanItem ? { activeKey: planKey(activePlanItem) } : {}),
                })}
          />
        </div>
      </div>

      {assign && (
        <AssignPicker
          classId={cls.id}
          slot={assign.slot}
          {...(assign.subjectId ? { subjectId: assign.subjectId } : {})}
          {...(assign.groupKey ? { groupKey: assign.groupKey } : {})}
          entries={entries}
          onClose={() => setAssign(null)}
          onSave={save}
          onPin={pin.start}
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
