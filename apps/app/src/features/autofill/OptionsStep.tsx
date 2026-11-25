// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { startOverDeletes, type Entry, type FillMode, type SchoolContext } from '@sathiya/core';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../ui/Alert';
import { Button } from '../../ui/Button';
import { MultiSelect } from '../../ui/MultiSelect';
import { RadioGroup } from '../../ui/RadioGroup';

export function OptionsStep({
  ctx,
  entries,
  mode,
  onChange,
  onRun,
  onBack,
}: {
  ctx: SchoolContext;
  entries: Entry[];
  mode: FillMode;
  onChange(mode: FillMode): void;
  onRun(): void;
  onBack(): void;
}) {
  const { t } = useTranslation('autofill');
  const grades = useMemo(() => [...ctx.grades].filter((g) => ctx.classes.some((c) => c.gradeId === g.id)).sort((a, b) => a.number - b.number), [ctx]);
  const gradeIds = mode.kind === 'startOver' ? mode.gradeIds : [];
  const replaced = useMemo(() => startOverDeletes(ctx, entries, gradeIds).length, [ctx, entries, gradeIds]);
  const option = (label: string, hint: string) => (
    <span className="flex flex-col">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="text-sm text-ink-soft">{hint}</span>
    </span>
  );

  return (
    <section>
      <h2 className="mb-3 text-base font-bold text-ink">{t('options.title')}</h2>
      <RadioGroup<FillMode['kind']>
        name="autofill-mode"
        label={t('options.label')}
        value={mode.kind}
        onChange={(kind) => onChange(kind === 'fillAround' ? { kind } : { kind, gradeIds: [] })}
        options={[
          { value: 'fillAround', label: option(t('options.fillAround'), t('options.fillAroundHint')) },
          { value: 'startOver', label: option(t('options.startOver'), t('options.startOverHint')) },
        ]}
      />
      {mode.kind === 'startOver' && (
        <div className="mt-4 max-w-md">
          <MultiSelect
            aria-label={t('options.grades')}
            placeholder={t('options.pickGrades')}
            value={mode.gradeIds}
            onChange={(ids) => onChange({ kind: 'startOver', gradeIds: grades.filter((g) => ids.includes(g.id)).map((g) => g.id) })}
            options={grades.map((g) => ({ value: g.id, label: t('options.gradeOption', { grade: g.number }) }))}
            className="w-full"
          />
          {mode.gradeIds.length > 0 && (
            <Alert tone={replaced > 0 ? 'warning' : 'info'} className="mt-3">
              {replaced > 0 ? t('options.replace', { count: replaced }) : t('options.nothingToReplace')}
            </Alert>
          )}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={onBack}>{t('options.back')}</Button>
        <Button variant="primary" disabled={mode.kind === 'startOver' && mode.gradeIds.length === 0} onClick={onRun}>
          {t('options.run')}
        </Button>
      </div>
    </section>
  );
}
