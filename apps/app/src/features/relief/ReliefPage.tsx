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
import { LinkButton } from '../../ui/LinkButton';
import { LoadingState } from '../../ui/LoadingState';
import { PageHeader } from '../../ui/PageHeader';
import { useAdminBase } from '../timetable/paths';
import { LeaveList } from './LeaveList';
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
import { ReliefList } from './ReliefList';
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
  const [unsaved, setUnsaved] = useState(false);

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
  const data = useReliefDay(school.id, published && day !== null ? yid : null, date);

  const pickDate = (next: string) => {
    if (!isIsoDate(next)) return;
    setParams(next >= today.date ? {} : { date: next });
  };

  const header = (
    <PageHeader
      title={t('title')}
      subtitle={isToday ? `${t('today')} · ${formatDate(date, lang)}` : `${formatDate(date, lang)} · ${t('viewOnly')}`}
      actions={
        <>
          <input
            type="date"
            aria-label={t('date')}
            value={date}
            max={today.date}
            onChange={(e) => pickDate(e.target.value)}
            className={`${inputClass} w-auto`}
          />
          {day !== null && published && (unsaved ? (
            <>
              <span id="relief-print-hint" className="hidden text-[13px] text-ink-muted sm:inline">
                {t('printSaveFirst')}
              </span>
              <Button disabled aria-label={t('print')} aria-describedby="relief-print-hint" title={t('printSaveFirst')}>
                <Icon name="print" size={16} />
                <span className="hidden sm:inline">{t('print')}</span>
              </Button>
            </>
          ) : (
            <LinkButton to={`${base}/print/relief/${date}`} aria-label={t('print')}>
              <Icon name="print" size={16} />
              <span className="hidden sm:inline">{t('print')}</span>
            </LinkButton>
          ))}
        </>
      }
    />
  );

  const body = (() => {
    if (loading) return <LoadingState />;
    if (day === null) return <EmptyState icon="calendar" title={isToday ? t('empty.weekend') : t('empty.weekendPast')} body={t('empty.weekendBody')} />;
    if (!published || !yid) return <EmptyState icon="calendar" title={t('empty.unpublished')} body={t('empty.unpublishedBody')} action={<DashboardLink base={base} />} />;
    if (data.loading) return <LoadingState />;
    if (data.error) return <Alert tone="danger">{t('loadFailed')}</Alert>;
    return <ReliefDayEditor key={date} sid={school.id} yid={yid} date={date} day={day} readOnly={viewOnly || !isToday} data={data} base={base} onDirty={setUnsaved} />;
  })();

  return (
    <div className="mx-auto max-w-4xl">
      {header}
      {body}
    </div>
  );
}

function DashboardLink({ base }: { base: string }) {
  const { t } = useTranslation('relief');
  return (
    <Link to={base} className="font-semibold text-brand underline underline-offset-2">
      {t('empty.dashboard')}
    </Link>
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
  onDirty(dirty: boolean): void;
}

function ReliefDayEditor({ sid, yid, date, day, readOnly, data, base, onDirty }: EditorProps) {
  const { t, i18n } = useTranslation('relief');
  const { t: tc } = useTranslation('common');
  const lang = i18n.language === 'si' ? 'si' : 'en';
  const school = useSchool();
  const { doc, snaps, stats, notified } = data;

  const [draft, setDraft] = useState<DayDraft | null>(null);
  const [draftBase, setDraftBase] = useState<number | null>(null);
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
    onDirty(!readOnly && dirty);
  }, [onDirty, readOnly, dirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
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
    if (draft === null) setDraftBase(doc?.updatedAt ?? null);
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

  const uncovered = current.reliefs.filter((r) => r.reliefTeacherId === null).length;

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
        expectedUpdatedAt: draft === null ? (doc?.updatedAt ?? null) : draftBase,
      });
      setResult(res);
      const sent = { leaves: current.leaves, reliefs: current.reliefs };
      setDraft(sent);
      setDraftBase(res.updatedAt);
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
    <div className="flex flex-col gap-4">
      <LeaveList
        leaves={current.leaves}
        reliefs={current.reliefs}
        snaps={snaps}
        day={day}
        names={names}
        readOnly={readOnly}
        disabled={saving}
        addable={addable}
        onAdd={(id) => setLeaves((ls) => [...ls, { teacherId: id, type: 'full', entryIds: defaultTicks(id, 'full') }])}
        onType={(id, type) => setLeaves((ls) => ls.map((l) => (l.teacherId === id ? { ...l, type, entryIds: defaultTicks(id, type) } : l)))}
        onTick={(id, entryId, on) =>
          setLeaves((ls) => ls.map((l) => (l.teacherId === id ? { ...l, entryIds: on ? [...l.entryIds, entryId] : l.entryIds.filter((x) => x !== entryId) } : l)))
        }
        onRemove={(id) => setLeaves((ls) => ls.filter((l) => l.teacherId !== id))}
      />

      <ReliefList
        reliefs={current.reliefs}
        gone={gone}
        names={names}
        readOnly={readOnly}
        disabled={saving}
        candidatesOf={(i) => candidates[i] ?? []}
        errorsOf={errorsOf}
        status={status}
        onPick={(i, id) => edit((d) => ({ ...d, reliefs: d.reliefs.map((r, j) => (j === i ? { ...r, reliefTeacherId: id } : r)) }))}
        onSuggest={() => edit((d) => {
          const slots = withLeaves(d.leaves, d.reliefs, snaps, day);
          return { ...slots, reliefs: suggestRelief(slots.reliefs, { ...reliefCtx, leaves: d.leaves }) };
        })}
      />

      {uncovered > 0 && (
        <Alert tone="warning">
          <span className="flex items-center gap-2">
            <Icon name="minus" size={16} />
            {t('uncovered', { count: uncovered })}
          </span>
        </Alert>
      )}

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

      {!readOnly && (
        <div className="sticky bottom-0 z-10 -mx-4 -mb-5 flex flex-col gap-2 border-t border-line-soft bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between md:static md:mx-0 md:mb-0 md:border-0 md:bg-transparent md:p-0">
          <p role="status" className="m-0 text-[13px] text-ink-soft">
            {summary ?? (doc && !dirty ? t('savedAt', { time: colomboTime(doc.updatedAt) }) : '')}
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => void save()}
            loading={saving}
            loadingLabel={t('saving')}
            disabled={!dirty}
            className="w-full sm:w-auto"
          >
            {t('save')}
          </Button>
        </div>
      )}
    </div>
  );
}
