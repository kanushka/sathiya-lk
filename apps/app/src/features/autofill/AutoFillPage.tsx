// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { readiness, type Allocation, type Entry, type FillMode, type SchoolContext } from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../ui/Alert';
import { Button } from '../../ui/Button';
import { LoadingState } from '../../ui/LoadingState';
import { PageHeader } from '../../ui/PageHeader';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { useTimetable } from '../timetable/useTimetable';
import { allocationKey } from './AllocationTab';
import { OptionsStep } from './OptionsStep';
import { PreviewPage } from './PreviewPage';
import { ReadinessList } from './ReadinessList';
import { useSolver } from './useSolver';

type Step = 'readiness' | 'options' | 'solve';

const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);

const plainCtx = (c: SchoolContext): SchoolContext => ({
  school: c.school,
  teachers: c.teachers,
  subjects: c.subjects,
  templates: c.templates,
  grades: c.grades,
  classes: c.classes,
});

export function AutoFillPage() {
  const ctx = useSchool();
  const year = useYear();
  if (ctx.loading || year.loading) return <LoadingState />;
  return <Flow />;
}

function Flow() {
  const { t } = useTranslation('autofill');
  const { ctx, entries } = useTimetable();
  const solver = useSolver();
  const [step, setStep] = useState<Step>('readiness');
  const [mode, setMode] = useState<FillMode>({ kind: 'fillAround' });
  const [overrides, setOverrides] = useState<Allocation[]>([]);
  const [ranWith, setRanWith] = useState<Entry[]>([]);

  function run(seed: number, ov: Allocation[] = overrides) {
    setOverrides(ov);
    setRanWith(entries);
    setStep('solve');
    solver.run({ ctx: plainCtx(ctx), entries, mode, seed, ...(ov.length > 0 ? { overrides: ov } : {}) });
  }

  function rerun(changed: Allocation[], seed: number) {
    const merged = new Map(overrides.map((o) => [allocationKey(o), o]));
    for (const o of changed) merged.set(allocationKey(o), o);
    run(seed, [...merged.values()]);
  }

  function backToOptions() {
    solver.cancel();
    setOverrides([]);
    setStep('options');
  }

  if (step === 'readiness') return <Readiness onContinue={() => setStep('options')} />;
  if (step === 'options') {
    return (
      <div className="max-w-3xl">
        <PageHeader title={t('title')} />
        <OptionsStep ctx={ctx} entries={entries} mode={mode} onChange={setMode} onRun={() => run(newSeed(), [])} onBack={() => setStep('readiness')} />
      </div>
    );
  }
  if (solver.state === 'done' && solver.result) {
    return <PreviewPage result={solver.result} entries={ranWith} onRerun={(changed) => rerun(changed, solver.result?.seed ?? newSeed())} onTryAgain={(changed) => rerun(changed, newSeed())} onDiscard={backToOptions} />;
  }
  if (solver.state === 'error') {
    return (
      <div className="max-w-3xl">
        <PageHeader title={t('title')} />
        <Alert tone="danger" role="alert">
          {t('error.title', { message: solver.error ?? '' })}
        </Alert>
        <Button className="mt-4" onClick={backToOptions}>
          {t('error.back')}
        </Button>
      </div>
    );
  }
  const unplaced = solver.progress?.best[0];
  return (
    <div className="max-w-3xl">
      <PageHeader title={t('title')} />
      <section role="status" className="rounded-xl border border-line bg-white p-4">
        <h2 className="m-0 text-base font-bold text-ink">{t('running.title')}</h2>
        <p className="m-0 mt-1 text-sm text-ink-soft">{t('running.hint')}</p>
        {solver.progress ? (
          <p className="m-0 mt-3 text-sm text-ink">
            <span>{t('running.attempt', { attempt: solver.progress.attempt })}</span>
            {unplaced !== undefined && <span className="block">{t('running.best', { count: unplaced })}</span>}
          </p>
        ) : (
          <p className="m-0 mt-3 text-sm text-ink">{t('running.starting')}</p>
        )}
      </section>
      <Button className="mt-4" onClick={backToOptions}>
        {t('running.cancel')}
      </Button>
    </div>
  );
}

function Readiness({ onContinue }: { onContinue(): void }) {
  const { t } = useTranslation('autofill');
  const { ctx, entries } = useTimetable();
  const { blocking, warnings } = useMemo(() => readiness(ctx, entries), [ctx, entries]);

  return (
    <div className="max-w-3xl">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {blocking.length > 0 ? (
        <>
          <Alert tone="danger">{t('blocking.summary', { count: blocking.length })}</Alert>
          <h2 className="sr-only">{t('blocking.title')}</h2>
          <div className="mt-4">
            <ReadinessList issues={blocking} grouped />
          </div>
        </>
      ) : (
        <Alert tone="success">
          <h2 className="m-0 text-base font-bold">{t('ready.title')}</h2>
          <p className="m-0 mt-1 font-normal">{t('ready.body')}</p>
        </Alert>
      )}
      {warnings.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-1 text-base font-bold text-ink">{t('warnings.title')}</h2>
          <p className="m-0 mb-1 text-sm text-ink-soft">{t('warnings.hint')}</p>
          <ReadinessList issues={warnings} grouped={false} />
        </section>
      )}
      <div className="mt-6">
        {blocking.length > 0 ? (
          <>
            <Button variant="primary" disabled aria-describedby="autofill-continue-help">
              {t('continue')}
            </Button>
            <p id="autofill-continue-help" className="mb-0 mt-2 text-sm text-ink-soft">
              {t('continueHelp')}
            </p>
          </>
        ) : (
          <Button variant="primary" onClick={onContinue}>
            {t('continue')}
          </Button>
        )}
      </div>
    </div>
  );
}
