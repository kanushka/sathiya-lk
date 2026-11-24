// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { DayIndex, TemplateRow } from '@sathiya/core';
import { toMinutes } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { inputBareCompactClass } from '../../ui/Field';
import { IconButton } from '../../ui/IconButton';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Tabs } from '../../ui/Tabs';
import { appendRow, DAY_INDEXES, toPerDay, type TemplateDraft, type ValidationError } from './model';

export interface TemplateEditorProps {
  draft: TemplateDraft;
  errors: ValidationError[];
  readOnly: boolean;
  onChange: (draft: TemplateDraft) => void;
}

const timeClass = `${inputBareCompactClass} h-10 w-24 text-center tabular-nums`;

export function TemplateEditor({ draft, errors, readOnly, onChange }: TemplateEditorProps) {
  const { t } = useTranslation('templates');
  const { t: tc } = useTranslation('common');
  const [day, setDay] = useState<DayIndex>(0);
  const perDay = draft.mode === 'perDay' && draft.days !== undefined;
  const rows = perDay ? draft.days![day] : draft.rows;

  const setRows = (next: TemplateRow[]) =>
    onChange(perDay ? { ...draft, days: { ...draft.days!, [day]: next } as Record<DayIndex, TemplateRow[]> } : { ...draft, rows: next });

  function setMode(mode: TemplateDraft['mode']) {
    if (mode === draft.mode) return;
    if (mode === 'perDay') onChange({ ...draft, mode, days: toPerDay(draft.rows) });
    else onChange({ name: draft.name, mode, rows: draft.days?.[day] ?? draft.rows });
    setDay(0);
  }

  const patchRow = (i: number, patch: Partial<TemplateRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const rowErrors = (i: number) => errors.some((e) => e.row === i && (e.day === null || e.day === day));

  let periodNo = 0;
  return (
    <div>
      <SegmentedControl
        aria-label={t('editor.modeLabel')}
        className="mb-4"
        disabled={readOnly}
        value={draft.mode}
        onChange={setMode}
        options={[
          { value: 'same', label: t('editor.same') },
          { value: 'perDay', label: t('editor.perDay') },
        ]}
      />

      {perDay && (
        <Tabs
          aria-label={t('editor.dayTabs')}
          className="mb-3"
          value={String(day)}
          onChange={(v) => setDay(Number(v) as DayIndex)}
          items={DAY_INDEXES.map((d) => ({ value: String(d), label: tc(`days.short.${d}`) }))}
        />
      )}

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => {
          if (r.type === 'period') periodNo += 1;
          const n = i + 1;
          return (
            <div
              key={i}
              data-testid="template-row"
              className={cx('flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-3 py-2 md:flex-nowrap md:gap-y-0', r.type === 'interval' ? 'bg-warning-soft' : 'bg-surface', rowErrors(i) && 'ring-2 ring-danger')}
            >
              <strong className="order-first min-w-0 flex-1 basis-[calc(100%-3.5rem)] text-sm md:order-none md:w-[110px] md:flex-none md:basis-auto">{r.type === 'period' ? tc('periods.period') + ' ' + periodNo : tc('periods.interval')}</strong>
              <input
                type="time"
                className={timeClass}
                aria-label={t('editor.start', { n })}
                value={r.start}
                disabled={readOnly}
                onChange={(e) => patchRow(i, { start: e.target.value })}
              />
              <span className="text-ink-muted">–</span>
              <input
                type="time"
                className={timeClass}
                aria-label={t('editor.end', { n })}
                value={r.end}
                disabled={readOnly}
                onChange={(e) => patchRow(i, { end: e.target.value })}
              />
              <span className="flex-1 text-[13px] text-ink-soft">{/^\d\d:\d\d$/.test(r.start) && /^\d\d:\d\d$/.test(r.end) ? t('editor.minutes', { n: Math.max(toMinutes(r.end) - toMinutes(r.start), 0) }) : ''}</span>
              {!readOnly && (
                <IconButton
                  icon="close"
                  size="sm"
                  label={t('editor.remove', { n })}
                  className="order-first md:order-none"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                />
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-3.5 flex gap-4">
          <Button variant="ghost" size="sm" onClick={() => setRows(appendRow(rows, 'period'))}>
            {t('editor.addPeriod')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRows(appendRow(rows, 'interval'))}>
            {t('editor.addInterval')}
          </Button>
        </div>
      )}
    </div>
  );
}
