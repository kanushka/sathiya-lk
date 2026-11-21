// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { DayIndex, TemplateRow } from '@sathiya/core';
import { toMinutes } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { appendRow, DAY_INDEXES, toPerDay, type TemplateDraft, type ValidationError } from './model';

export interface TemplateEditorProps {
  draft: TemplateDraft;
  errors: ValidationError[];
  readOnly: boolean;
  onChange: (draft: TemplateDraft) => void;
}

const timeClass =
  'box-border h-[38px] w-24 rounded-lg border border-line-strong bg-white text-center text-[15px] tabular-nums focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50';

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
  const modeBtn = (mode: TemplateDraft['mode'], label: string) => (
    <button
      type="button"
      aria-pressed={draft.mode === mode}
      disabled={readOnly}
      onClick={() => setMode(mode)}
      className={cx('px-3 py-2 text-[13px] font-semibold', draft.mode === mode ? 'bg-ink text-white' : 'text-ink-soft')}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-4 inline-flex overflow-hidden rounded-lg border border-line-strong">
        {modeBtn('same', t('editor.same'))}
        {modeBtn('perDay', t('editor.perDay'))}
      </div>

      {perDay && (
        <div role="tablist" className="mb-3 flex gap-1.5">
          {DAY_INDEXES.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === day}
              onClick={() => setDay(d)}
              className={cx('rounded-lg px-3.5 py-1.5 text-sm font-semibold', d === day ? 'bg-brand/10 text-brand' : 'text-ink-soft hover:bg-slate-50')}
            >
              {tc(`days.short.${d}`)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => {
          if (r.type === 'period') periodNo += 1;
          const n = i + 1;
          return (
            <div
              key={i}
              data-testid="template-row"
              className={cx('flex items-center gap-3 rounded-[10px] px-3 py-2', r.type === 'interval' ? 'bg-[#FBF1DC]' : 'bg-[#FAFAFB]', rowErrors(i) && 'ring-2 ring-[#A3262A]')}
            >
              <strong className="w-[110px] text-sm">{r.type === 'period' ? tc('periods.period') + ' ' + periodNo : tc('periods.interval')}</strong>
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
                <button type="button" aria-label={t('editor.remove', { n })} className="border-0 bg-transparent text-base text-ink-muted" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  ×
                </button>
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
