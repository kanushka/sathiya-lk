// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  candidatesFor,
  colomboToday,
  lessonsForLeave,
  suggestRelief,
  type DayIndex,
  type Leave,
  type LeaveType,
  type Relief,
  type ReliefCtx,
  type ReliefError,
  type SaveReliefDayRes,
} from '@sathiya/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { call, toApiError } from '../../lib/callable';
import { useReadOnly } from '../../ui/AdminLayout';
import { Alert } from '../../ui/Alert';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { inputClass } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import { LinkButton } from '../../ui/LinkButton';
import { LoadingState } from '../../ui/LoadingState';
import { PageHeader } from '../../ui/PageHeader';
import { useAdminBase } from '../timetable/paths';
import {
  colomboTime,
  countsExcludingSaved,
  currentSaved,
  emailStatus,
  formatDate,
  isIsoDate,
  namesFor,
  reliefKey,
  sameDraft,
  weekdayOf,
  withLeaves,
  type DayDraft,
} from './model';
import { ReliefPlan } from './ReliefPlan';
import { useReliefDay, type ReliefDayState } from './useReliefDay';

type Problem = { kind: 'stale' } | { kind: 'republish' } | { kind: 'notToday' } | { kind: 'invalid'; errors: ReliefError[] } | { kind: 'failed'; message: string };

export function ReliefPage() {
  const { t, i18n } = useTranslation('relief');
  const lang = i18n.language === 'si' ? 'si' : 'en';
  const { school, loading } = useSchool();
  const { years } = useYear();
  const viewOnly = useReadOnly();
  const base = useAdminBase();
  const [params, setParams] = useSearchParams();
  const [today, setToday] = useState(() => colomboToday(new Date()));

  useEffect(() => {
    const check = () => setToday((prev) => {
      const next = colomboToday(new Date());
      return next.date === prev.date ? prev : next;
    });
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  const requested = params.get('date');
  const date = isIsoDate(requested) && requested < today.date ? requested : today.date;
  const isToday = date === today.date;
  const day = isToday ? today.day : weekdayOf(date);
  const yid = school.activeYearId ?? null;
  const published = years.some((y) => y.id === yid && y.status === 'published');
  const live = published && yid !== null;
  const data = useReliefDay(school.id, published && day !== null ? yid : null, date);

  const pickDate = (next: string) => {
    if (!isIsoDate(next)) return;
    setParams(next >= today.date ? {} : { date: next });
  };

  const shift = (days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    pickDate(d.toISOString().slice(0, 10));
  };

  const dateNav = (
        <div className="flex items-center gap-1.5">
          <IconButton icon="chevronLeft" variant="secondary" label={t('prevDay')} onClick={() => shift(-1)} />
          <input
            type="date"
            aria-label={t('date')}
            value={date}
            max={today.date}
            onChange={(e) => pickDate(e.target.value)}
            className={`${inputClass} w-auto`}
          />
          <IconButton icon="chevronRight" variant="secondary" label={t('nextDay')} disabled={isToday} onClick={() => shift(1)} />
        </div>
  );
  const header = (
    <PageHeader
      title={t('title')}
      subtitle={live ? (isToday ? `${t('today')} · ${formatDate(date, lang)}` : `${formatDate(date, lang)} · ${t('viewOnly')}`) : undefined}
      actions={live ? dateNav : undefined}
      phoneActions={live ? dateNav : null}
    />
  );

  const body = (() => {
    if (loading) return <LoadingState />;
    if (!live) return <EmptyState icon="calendar" title={t('empty.unpublished')} body={t('empty.unpublishedBody')} action={<DashboardLink base={base} />} />;
    if (day === null) return <EmptyState icon="calendar" title={isToday ? t('empty.weekend') : t('empty.weekendPast')} body={t('empty.weekendBody')} />;
    if (data.loading) return <LoadingState />;
    if (data.error) return <Alert tone="danger">{t('loadFailed')}</Alert>;
    return <ReliefDayEditor key={date} sid={school.id} yid={yid} date={date} day={day} readOnly={viewOnly || !isToday} data={data} base={base} />;
  })();

  return (
    <div className="mx-auto max-w-6xl">
      {header}
      {body}
    </div>
  );
}

function DashboardLink({ base }: { base: string }) {
  const { t } = useTranslation('relief');
  return (
    <LinkButton variant="primary" to={base}>
      {t('empty.dashboard')}
    </LinkButton>
  );
}

interface EditorProps {
  sid: string;
  yid: string;
  date: string;
  day: DayIndex;
  readOnly: boolean;
  data: ReliefDayState;
  base: string;
}

function ReliefDayEditor({ sid, yid, date, day, readOnly, data, base }: EditorProps) {
  const { t, i18n } = useTranslation('relief');
  const { t: tc } = useTranslation('common');
  const lang = i18n.language === 'si' ? 'si' : 'en';
  const school = useSchool();
  const { doc, snaps, stats, notified } = data;

  const [draft, setDraft] = useState<DayDraft | null>(null);
  const [lastSave, setLastSave] = useState<{ updatedAt: number; draft: DayDraft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [result, setResult] = useState<SaveReliefDayRes | null>(null);

  const { saved, gone } = useMemo(
    () => (readOnly ? { saved: { leaves: doc?.leaves ?? [], reliefs: doc?.reliefs ?? [] }, gone: [] } : currentSaved(doc, snaps, day)),
    [readOnly, doc, snaps, day],
  );
  const current = draft ?? saved;

  const awaiting = lastSave !== null && doc?.updatedAt !== lastSave.updatedAt;
  const dirty = (!awaiting && gone.length > 0) || !sameDraft(current, awaiting ? lastSave.draft : saved);
  useEffect(() => {
    if (lastSave === null || doc?.updatedAt !== lastSave.updatedAt) return;
    if (draft && sameDraft(draft, lastSave.draft)) setDraft(null);
    setLastSave(null);
  }, [lastSave, draft, doc]);

  const names = useMemo(() => namesFor(school, lang, doc, snaps, (n) => tc('periods.periodN', { n })), [school, lang, doc, snaps, tc]);
  const teacherById = useMemo(() => new Map(school.teachers.map((x) => [x.id, x])), [school.teachers]);
  const gradeOfClass = useMemo(() => {
    const gradeNo = new Map(school.grades.map((g) => [g.id, g.number]));
    return new Map(school.classes.flatMap((c) => (gradeNo.has(c.gradeId) ? [[c.id, gradeNo.get(c.gradeId)!] as const] : [])));
  }, [school.grades, school.classes]);
  const liveCounts = useMemo(() => countsExcludingSaved(stats, doc), [stats, doc]);
  // Stats and the day doc arrive on separate listeners after a save; ranking on one without the other double-counts.
  const settledCounts = useRef(liveCounts);
  if (!awaiting) settledCounts.current = liveCounts;
  const counts = awaiting ? settledCounts.current : liveCounts;
  const reliefCtx = useMemo<ReliefCtx>(
    () => ({ teachers: school.teachers, snaps, gradeOfClass, day, leaves: current.leaves, counts }),
    [school.teachers, snaps, gradeOfClass, day, current.leaves, counts],
  );
  const candidates = useMemo(
    () => (readOnly ? [] : current.reliefs.map((r, i) => candidatesFor(r, current.reliefs.filter((o, j) => j !== i && o.reliefTeacherId !== null), reliefCtx))),
    [readOnly, current.reliefs, reliefCtx],
  );

  const republishNeeded = useMemo(() => [...snaps.values()].some((s) => s.cells.some((c) => c.entryId === undefined)), [snaps]);
  if (republishNeeded || problem?.kind === 'republish') {
    return <EmptyState icon="calendar" title={t('empty.republish')} body={t('empty.republishBody')} action={<DashboardLink base={base} />} />;
  }
  if (readOnly && !doc) return <EmptyState icon="calendar" title={t('empty.noRecord')} />;

  const edit = (fn: (d: DayDraft) => DayDraft) => {
    setResult(null);
    setDraft((prev) => fn(prev ?? saved));
  };
  const setLeaves = (fn: (leaves: Leave[]) => Leave[]) => edit((d) => withLeaves(fn(d.leaves), d.reliefs, snaps, day));
  const defaultTicks = (teacherId: string, type: LeaveType): string[] => {
    const snap = snaps.get(teacherId);
    return snap ? lessonsForLeave(snap, day, type).flatMap((c) => (c.entryId === undefined ? [] : [c.entryId])) : [];
  };

  const onLeave = new Set(current.leaves.map((l) => l.teacherId));
  const addable = school.teachers.filter((x) => !onLeave.has(x.id)).sort((a, b) => names.teacher(a.id).localeCompare(names.teacher(b.id)));

  const errors = problem?.kind === 'invalid' ? problem.errors : [];
  const errorsOf = (r: DayDraft['reliefs'][number]) =>
    errors
      .filter((e) => e.entryId === r.entryId && (e.teacherId === r.reliefTeacherId || (e.code === 'not-on-leave-lesson' && e.teacherId === r.absentTeacherId)))
      .map((e) => t(`errors.codes.${e.code}`));

  const savedPick = new Map((doc?.reliefs ?? []).map((r) => [reliefKey(r), r.reliefTeacherId]));
  const status = (r: Relief) => {
    const tid = r.reliefTeacherId;
    if (tid === null || savedPick.get(reliefKey(r)) !== tid) return null;
    const s = emailStatus(tid, notified, teacherById.get(tid));
    if (!s) return null;
    if (s.kind === 'pending') return <Badge tone="warning">{t('status.pending')}</Badge>;
    if (s.kind === 'sent') return <Badge tone="success">{t('status.sent', { time: colomboTime(s.at) })}</Badge>;
    return <Badge>{t('status.noEmail')}</Badge>;
  };

  const covered = current.reliefs.filter((r) => r.reliefTeacherId !== null);
  const uncovered = current.reliefs.length - covered.length;
  const noEmail = new Set(
    covered.flatMap((r) => {
      const x = teacherById.get(r.reliefTeacherId!);
      return x && !x.email?.trim() && !x.uid ? [x.id] : [];
    }),
  ).size;
  const needed = current.reliefs.length;
  const unsaved = !readOnly && dirty;

  async function save() {
    setSaving(true);
    setProblem(null);
    setResult(null);
    try {
      const res = await call('saveReliefDay', {
        schoolId: sid,
        yearId: yid,
        date,
        leaves: current.leaves,
        reliefs: current.reliefs,
        expectedUpdatedAt: awaiting ? lastSave.updatedAt : (doc?.updatedAt ?? null),
      });
      setResult(res);
      const sent = { leaves: current.leaves, reliefs: current.reliefs };
      setDraft(sent);
      setLastSave({ updatedAt: res.updatedAt, draft: sent });
    } catch (err) {
      const e = toApiError(err);
      if (e.code === 'stale') setProblem({ kind: 'stale' });
      else if (e.code === 'republish') setProblem({ kind: 'republish' });
      else if (e.code === 'not-today') setProblem({ kind: 'notToday' });
      else if (e.code === 'invalid-relief') setProblem({ kind: 'invalid', errors: (e.details as { errors?: ReliefError[] } | undefined)?.errors ?? [] });
      else setProblem({ kind: 'failed', message: e.message });
    } finally {
      setSaving(false);
    }
  }

  const reload = () => {
    setDraft(null);
    setLastSave(null);
    setProblem(null);
    setResult(null);
    data.reloadSnaps?.();
  };

  const summary = result && [
    result.queued > 0 || result.skippedNoEmail > 0 ? null : t('summary.none'),
    result.queued > 0 ? t('summary.queued', { count: result.queued }) : null,
    result.skippedNoEmail > 0 ? t('summary.skipped', { count: result.skippedNoEmail }) : null,
    result.uncovered > 0 ? t('summary.uncovered', { count: result.uncovered }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        <ReliefPlan
          leaves={current.leaves}
          reliefs={current.reliefs}
          gone={gone}
          snaps={snaps}
          day={day}
          names={names}
          readOnly={readOnly}
          addable={addable}
          candidatesOf={(i) => candidates[i] ?? []}
          errorsOf={errorsOf}
          status={status}
          onAdd={(id) => setLeaves((ls) => [...ls, { teacherId: id, type: 'full', entryIds: defaultTicks(id, 'full') }])}
          onType={(id, type) => setLeaves((ls) => ls.map((l) => (l.teacherId === id ? { ...l, type, entryIds: defaultTicks(id, type) } : l)))}
          onTick={(id, entryId, on) =>
            setLeaves((ls) => ls.map((l) => (l.teacherId === id ? { ...l, entryIds: on ? [...l.entryIds, entryId] : l.entryIds.filter((x) => x !== entryId) } : l)))
          }
          onRemove={(id) => setLeaves((ls) => ls.filter((l) => l.teacherId !== id))}
          onPick={(i, id) => edit((d) => ({ ...d, reliefs: d.reliefs.map((r, j) => (j === i ? { ...r, reliefTeacherId: id } : r)) }))}
          onSuggest={() => edit((d) => {
            const slots = withLeaves(d.leaves, d.reliefs, snaps, day);
            return { ...slots, reliefs: suggestRelief(slots.reliefs, { ...reliefCtx, leaves: d.leaves }) };
          })}
        />

        {problem?.kind === 'stale' && (
          <Alert tone="danger">
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span>{t('errors.stale')}</span>
              <Button size="sm" variant="secondary" onClick={reload}>
                {t('errors.reload')}
              </Button>
            </span>
          </Alert>
        )}
        {problem?.kind === 'invalid' && <Alert tone="danger">{t('errors.invalid')}</Alert>}
        {problem?.kind === 'notToday' && <Alert tone="danger">{t('errors.notToday')}</Alert>}
        {problem?.kind === 'failed' && <Alert tone="danger">{t('errors.failed', { message: problem.message })}</Alert>}
      </div>

      <aside aria-labelledby="relief-summary-title" className="flex flex-col gap-3 lg:sticky lg:top-4">
        <section className="rounded-[14px] border border-line-soft bg-white p-4 md:p-5">
          <h2 id="relief-summary-title" className="m-0 text-xs font-bold uppercase tracking-[.06em] text-ink-muted">
            {readOnly ? t('rail.titlePast') : t('rail.title')}
          </h2>
          <p className="mb-0 mt-2.5 flex items-baseline gap-1.5">
            <strong className="text-[30px] leading-none tabular-nums text-ink">{covered.length}</strong>
            <span className="text-[15px] text-ink-soft">{t('rail.covered', { count: needed })}</span>
          </p>
          <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className={uncovered === 0 && needed > 0 ? 'h-full rounded-full bg-fill-success' : 'h-full rounded-full bg-fill-warning'}
              style={{ width: needed ? `${Math.round((covered.length / needed) * 100)}%` : '0%' }}
            />
          </div>
          {uncovered > 0 && (
            <p className="mb-0 mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-warning">
              <Icon name="minus" size={14} />
              {t('uncovered', { count: uncovered })}
            </p>
          )}
          <dl className="m-0 mt-3 text-sm">
            {[
              [t('rail.onLeave'), current.leaves.length],
              [t('rail.uncovered'), uncovered],
              [t('rail.noEmail'), noEmail],
            ].map(([label, n]) => (
              <div key={label} className="flex items-center justify-between border-t border-line-soft py-2">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="m-0 font-bold tabular-nums text-ink">{n}</dd>
              </div>
            ))}
          </dl>
          {!readOnly && (
            <>
              <Button variant="primary" onClick={() => void save()} loading={saving} loadingLabel={t('saving')} disabled={!dirty} className="mt-3 w-full">
                {t('save')}
              </Button>
              <p role="status" className="mb-0 mt-2 text-center text-xs text-ink-muted">
                {summary ?? (doc && !dirty ? t('savedAt', { time: colomboTime(doc.updatedAt) }) : dirty ? t('rail.unsaved') : '')}
              </p>
            </>
          )}
        </section>
        {unsaved ? (
          <Button disabled className="w-full" aria-label={t('print')} title={t('printSaveFirst')}>
            <Icon name="print" size={16} />
            {t('printSaveFirst')}
          </Button>
        ) : (
          <LinkButton to={`${base}/print/relief/${date}`} aria-label={t('print')} className="w-full">
            <Icon name="print" size={16} />
            {t('rail.print')}
          </LinkButton>
        )}
      </aside>
    </div>
  );
}
