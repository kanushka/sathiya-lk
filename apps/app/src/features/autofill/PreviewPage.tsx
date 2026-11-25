// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { classPlacement, formatSummary, placementSummary, withTeacherIds, type Allocation, type Entry, type SolveResult } from '@sathiya/core';
import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { ApiError, isSchoolDisabled } from '../../lib/callable';
import { useReadOnly } from '../../ui/AdminLayout';
import { Alert } from '../../ui/Alert';
import { Button } from '../../ui/Button';
import { PageHeader } from '../../ui/PageHeader';
import { tabId, tabPanelId, Tabs } from '../../ui/Tabs';
import { useToast } from '../../ui/Toast';
import { sortedClasses } from '../timetable/ClassViewPage';
import { useAdminBase } from '../timetable/paths';
import { TimetableApiContext } from '../timetable/useTimetable';
import { AllocationTab, allocationKey } from './AllocationTab';
import { ClassesTab } from './ClassesTab';
import { UnplacedTab } from './UnplacedTab';

type Tab = 'allocation' | 'classes' | 'unplaced';
type SaveError = { kind: 'clash' | 'busy' | 'failed' | 'suspended' } | { kind: 'partial'; written: number; deleted: number };

const TAB_ID = 'autofill-preview';

function saveError(err: unknown): SaveError {
  if (isSchoolDisabled(err)) return { kind: 'suspended' };
  if (err instanceof ApiError && (err.code === 'clash' || err.code === 'busy')) return { kind: err.code };
  const d = (err as { details?: { written?: unknown; deleted?: unknown } } | null)?.details;
  if (typeof d?.written === 'number' && typeof d.deleted === 'number' && d.written + d.deleted > 0) return { kind: 'partial', written: d.written, deleted: d.deleted };
  return { kind: 'failed' };
}

export function PreviewPage({
  result,
  entries,
  onRerun,
  onTryAgain,
  onDiscard,
}: {
  result: SolveResult;
  entries: Entry[];
  onRerun(overrides: Allocation[]): void;
  onTryAgain(overrides: Allocation[]): void;
  onDiscard(): void;
}) {
  const { t } = useTranslation('autofill');
  const { t: ts } = useTranslation('shell');
  const { lang } = useLang();
  const ctx = useSchool();
  const { yearId } = useYear();
  const api = useContext(TimetableApiContext);
  const toast = useToast();
  const navigate = useNavigate();
  const base = useAdminBase();
  const readOnly = useReadOnly();
  const [tab, setTab] = useState<Tab>('allocation');
  const [edits, setEdits] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<SaveError | null>(null);
  const stale = edits.size > 0;

  const { kept, added } = useMemo(() => {
    const removed = new Set(result.deleteEntryIds);
    return {
      kept: entries.filter((e) => !removed.has(e.id)),
      added: result.drafts.map((d, i): Entry => ({ ...withTeacherIds(d), id: `autofill-${i}` })),
    };
  }, [entries, result]);

  const classIds = useMemo(() => [...new Set([...result.allocation.map((a) => a.classId), ...result.drafts.flatMap((d) => d.classIds)])], [result]);

  const grades = useMemo(() => {
    const after = [...kept, ...added];
    const inScope = sortedClasses(ctx).filter((c) => classIds.includes(c.id));
    const gradeIds = [...new Set(inScope.map((c) => c.gradeId))];
    return gradeIds.map((id) => {
      const grade = ctx.grades.find((g) => g.id === id);
      const rows = ctx.classes.filter((c) => c.gradeId === id).flatMap((c) => classPlacement(c, after, ctx).rows);
      return { id, number: grade?.number ?? '', summary: formatSummary(placementSummary(rows), lang) };
    });
  }, [ctx, kept, added, classIds, lang]);

  function edit(row: Allocation, teacherId: string) {
    const cls = ctx.classes.find((c) => c.id === row.classId);
    const sameBlock = (a: Allocation) => {
      if (a === row) return true;
      if (!row.planKey.startsWith('group:') || a.planKey !== row.planKey || a.subjectId !== row.subjectId || a.teacherId !== row.teacherId) return false;
      const other = ctx.classes.find((c) => c.id === a.classId);
      return !!cls && !!other && other.gradeId === cls.gradeId && other.templateId === cls.templateId;
    };
    setEdits((prev) => {
      const next = new Map(prev);
      for (const a of result.allocation.filter(sameBlock)) {
        if (teacherId === a.teacherId) next.delete(allocationKey(a));
        else next.set(allocationKey(a), teacherId);
      }
      return next;
    });
  }

  const edited = (): Allocation[] => result.allocation.filter((a) => edits.has(allocationKey(a))).map((a) => ({ ...a, teacherId: edits.get(allocationKey(a))! }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await api.applyAutoFill({ schoolId: ctx.school.id, yearId, deleteEntryIds: result.deleteEntryIds, drafts: result.drafts });
      toast.show(t('preview.saved', { count: res.written }), 'success');
      navigate(`${base}/timetable/class`);
    } catch (err) {
      setError(saveError(err));
      setSaving(false);
    }
  }

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'allocation', label: t('preview.tab.allocation') },
    { value: 'classes', label: t('preview.tab.classes') },
    { value: 'unplaced', label: t('preview.tab.unplaced', { count: result.unplaced.length }) },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader title={t('preview.title')} subtitle={t('preview.subtitle')} />

      <section aria-label={t('preview.summary')} className="mb-4 rounded-xl border border-line bg-white p-4">
        <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-sm">
          {grades.map((g) => (
            <li key={g.id} className="flex flex-col">
              <span className="text-ink-soft">{t('preview.grade', { grade: g.number })}</span>
              <b className="text-ink">{g.summary}</b>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-3 text-sm text-ink">
          <span>{t('preview.unplaced', { count: result.unplaced.length })}</span> · <span>{t('preview.samePattern', { percent: Math.round(result.soft.samePattern * 100) })}</span>
        </p>
        <p className="m-0 mt-1 text-xs text-ink-muted">
          {t('preview.changes', { added: result.drafts.length, removed: result.deleteEntryIds.length })} · {t('preview.seed', { seed: result.seed })}
        </p>
      </section>

      {stale && (
        <Alert tone="warning" className="mb-4">
          <p className="m-0">{t('preview.stale')}</p>
          <Button variant="primary" size="sm" className="mt-2" onClick={() => onRerun(edited())}>
            {t('preview.rerunPlacement')}
          </Button>
        </Alert>
      )}

      {error && (
        <Alert tone="danger" role="alert" className="mb-4">
          {error.kind === 'clash' ? (
            <>
              <p className="m-0">{t('preview.clash')}</p>
              <Button variant="primary" size="sm" className="mt-2" onClick={() => onRerun([])}>
                {t('preview.rerun')}
              </Button>
            </>
          ) : error.kind === 'partial' ? (
            t('preview.partial', { written: error.written, deleted: error.deleted })
          ) : error.kind === 'suspended' ? (
            ts('suspended.writeBlocked')
          ) : (
            t(`preview.${error.kind}`)
          )}
        </Alert>
      )}

      <Tabs aria-label={t('preview.tabs')} items={tabs} value={tab} onChange={setTab} idBase={TAB_ID} className="mb-4" />
      <div role="tabpanel" id={tabPanelId(TAB_ID, tab)} aria-labelledby={tabId(TAB_ID, tab)}>
        {tab === 'allocation' && <AllocationTab ctx={ctx} allocation={result.allocation} edits={edits} lang={lang} onEdit={edit} />}
        {tab === 'classes' && <ClassesTab ctx={ctx} kept={kept} added={added} classIds={classIds} lang={lang} />}
        {tab === 'unplaced' && <UnplacedTab ctx={ctx} unplaced={result.unplaced} lang={lang} />}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={onDiscard} disabled={saving}>
          {t('preview.discard')}
        </Button>
        <Button onClick={() => onTryAgain(edited())} disabled={saving}>
          {t('preview.tryAgain')}
        </Button>
        {!readOnly && (
          <Button variant="primary" onClick={save} disabled={stale || saving} loading={saving} loadingLabel={t('preview.saving')}>
            {t('preview.save')}
          </Button>
        )}
      </div>
    </div>
  );
}
