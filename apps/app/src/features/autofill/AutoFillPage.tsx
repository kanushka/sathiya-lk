// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { readiness } from '@sathiya/core';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../ui/Alert';
import { Button } from '../../ui/Button';
import { LoadingState } from '../../ui/LoadingState';
import { PageHeader } from '../../ui/PageHeader';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { useTimetable } from '../timetable/useTimetable';
import { ReadinessList } from './ReadinessList';

export function AutoFillPage() {
  const ctx = useSchool();
  const year = useYear();
  if (ctx.loading || year.loading) return <LoadingState />;
  return <Readiness />;
}

function Readiness() {
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
          <p className="m-0 text-sm text-ink-soft">{t('ready.next')}</p>
        )}
      </div>
    </div>
  );
}
