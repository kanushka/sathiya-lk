// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { DayIndex, TemplateRow } from '@sathiya/core';
import { pickName, toMinutes } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { inputBareCompactClass } from '../../ui/Field';
import { IconButton } from '../../ui/IconButton';
import { Select } from '../../ui/Select';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Tabs } from '../../ui/Tabs';
import { appendRow, DAY_INDEXES, toPerDay, type TemplateDraft, type ValidationError } from './model';

export interface TemplateEditorProps {
  draft: TemplateDraft;
  errors: ValidationError[];
  readOnly: boolean;
  onChange: (draft: TemplateDraft) => void;
}

const NO_SUBJECT = 'none';
const ROW_TYPES: TemplateRow['type'][] = ['period', 'interval', 'activity'];
const nameClass = `${inputBareCompactClass} h-10 min-w-[160px] flex-1`;
const timeClass = `${inputBareCompactClass} h-10 w-24 text-center tabular-nums`;

export function TemplateEditor({ draft, errors, readOnly, onChange }: TemplateEditorProps) {
  const { t } = useTranslation('templates');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const { subjects } = useSchool();
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

  const patchRow = (i: number, patch: Partial<TemplateRow>) =>
    setRows(
      rows.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...patch };
        if (next.type !== 'activity') {
          delete next.nameEn;
          delete next.nameSi;
          delete next.subjectId;
        }
        if (next.subjectId === undefined) delete next.subjectId;
        return next;
      }),
    );
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
          const typeLabel = (v: TemplateRow['type']) => t(`editor.type.${v}`);
          return (
            <div
              key={i}
              data-testid="template-row"
              className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2', r.type !== 'period' ? 'bg-warning-soft' : 'bg-surface', rowErrors(i) && 'ring-2 ring-danger')}
            >
              <div className="flex w-[150px] items-center gap-2">
                <Select
                  size="sm"
                  className="w-[110px]"
                  aria-label={t('editor.rowType', { n })}
                  disabled={readOnly}
                  value={r.type}
                  options={ROW_TYPES.map((v) => ({ value: v, label: typeLabel(v) }))}
                  onChange={(type) => patchRow(i, { type })}
                />
                {r.type === 'period' && <strong className="text-sm tabular-nums">{tc('periods.periodN', { n: periodNo })}</strong>}
              </div>
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
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                />
              )}
              {r.type === 'activity' && (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <input
                    className={nameClass}
                    aria-label={t('editor.activityNameEn', { n })}
                    placeholder={t('editor.activityNameEnPlaceholder')}
                    aria-invalid={errors.some((e) => e.code === 'activityName' && e.row === i && (e.day === null || e.day === day)) || undefined}
                    value={r.nameEn ?? ''}
                    disabled={readOnly}
                    onChange={(e) => patchRow(i, { nameEn: e.target.value })}
                  />
                  <input
                    className={nameClass}
                    aria-label={t('editor.activityNameSi', { n })}
                    placeholder={t('editor.activityNameSiPlaceholder')}
                    value={r.nameSi ?? ''}
                    disabled={readOnly}
                    onChange={(e) => patchRow(i, { nameSi: e.target.value })}
                  />
                  <Select
                    size="sm"
                    className="w-[200px]"
                    aria-label={t('editor.activitySubject', { n })}
                    disabled={readOnly}
                    value={r.subjectId ?? NO_SUBJECT}
                    options={[
                      { value: NO_SUBJECT, label: t('editor.noSubject') },
                      ...subjects.map((s) => ({ value: s.id, label: pickName(s, lang) })),
                    ]}
                    onChange={(v) => patchRow(i, { subjectId: v === NO_SUBJECT ? undefined : v })}
                  />
                </div>
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
          <Button variant="ghost" size="sm" onClick={() => setRows(appendRow(rows, 'activity'))}>
            {t('editor.addActivity')}
          </Button>
        </div>
      )}
    </div>
  );
}
