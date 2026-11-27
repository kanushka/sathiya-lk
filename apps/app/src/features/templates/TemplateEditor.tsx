// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { DayIndex, TemplateRow } from '@sathiya/core';
import { pickName } from '@sathiya/core';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { Alert } from '../../ui/Alert';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { inputBareCompactClass } from '../../ui/Field';
import { IconButton } from '../../ui/IconButton';
import { Select } from '../../ui/Select';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Tabs } from '../../ui/Tabs';
import {
  appendRow,
  DAY_INDEXES,
  dayStart,
  hasGaps,
  insertRow,
  MINUTES_STEP,
  moveRow,
  removeRow,
  rowMinutes,
  setDayStart,
  setRowMinutes,
  toPerDay,
  type TemplateDraft,
  type ValidationError,
} from './model';

export interface TemplateEditorProps {
  draft: TemplateDraft;
  errors: ValidationError[];
  readOnly: boolean;
  onChange: (draft: TemplateDraft) => void;
}

const NO_SUBJECT = 'none';
const ROW_TYPES: TemplateRow['type'][] = ['period', 'interval', 'activity'];
const nameClass = `${inputBareCompactClass} h-10 min-w-[160px] flex-1`;

export function TemplateEditor({ draft, errors, readOnly, onChange }: TemplateEditorProps) {
  const { t } = useTranslation('templates');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const { subjects } = useSchool();
  const [day, setDay] = useState<DayIndex>(0);
  const [inserting, setInserting] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const rowEls = useRef<(HTMLDivElement | null)[]>([]);
  const refocus = useRef<number | null>(null);
  const perDay = draft.mode === 'perDay' && draft.days !== undefined;
  const rows = perDay ? draft.days![day] : draft.rows;

  useLayoutEffect(() => {
    if (refocus.current === null) return;
    rowEls.current[refocus.current]?.querySelector<HTMLElement>('[data-drag-handle]')?.focus();
    refocus.current = null;
  });

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

  function onHandleKey(e: KeyboardEvent, i: number) {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
    if (to === null || to < 0 || to >= rows.length) return;
    e.preventDefault();
    refocus.current = to;
    setRows(moveRow(rows, i, to));
  }

  function dropIndex(y: number): number {
    let to = 0;
    rowEls.current.slice(0, rows.length).forEach((el, j) => {
      if (!el) return;
      const box = el.getBoundingClientRect();
      if (y > box.top + box.height / 2) to = j;
    });
    return to;
  }

  function onHandleDown(e: PointerEvent<HTMLButtonElement>, i: number) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: i, to: i });
  }
  function onHandleMove(e: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const to = dropIndex(e.clientY);
    if (to !== drag.to) setDrag({ ...drag, to });
  }
  function onHandleUp() {
    if (!drag) return;
    if (drag.to !== drag.from) setRows(moveRow(rows, drag.from, drag.to));
    setDrag(null);
  }

  const start = dayStart(rows);
  const end = rows.at(-1)?.end ?? start;
  const periods = rows.filter((r) => r.type === 'period');
  const teaching = periods.reduce((sum, r) => sum + rowMinutes(r), 0);

  const insertSlot = (at: number) =>
    readOnly ? null : (
      <div className="flex h-6 items-center justify-center">
        {inserting === at ? (
          <span className="flex flex-wrap items-center gap-1 rounded-full border border-line bg-white px-1.5 py-0.5 shadow-sm">
            {ROW_TYPES.map((type) => (
              <Button
                key={type}
                variant="ghost"
                size="sm"
                className="!h-7"
                onClick={() => {
                  setRows(insertRow(rows, at, type));
                  setInserting(null);
                }}
              >
                {t(`editor.type.${type}`)}
              </Button>
            ))}
            <IconButton icon="close" size="sm" label={t('editor.insertClose')} onClick={() => setInserting(null)} />
          </span>
        ) : (
          <button
            type="button"
            aria-label={t('editor.insertHere', { n: at + 1 })}
            className="rounded-full border border-line-soft bg-white px-2.5 text-xs font-semibold leading-5 text-brand opacity-50 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand"
            onClick={() => setInserting(at)}
          >
            {t('editor.insert')}
          </button>
        )}
      </div>
    );

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

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex items-center gap-2 text-sm font-semibold">
          {t('editor.dayStart')}
          <input
            type="time"
            className={`${inputBareCompactClass} h-10 w-28 text-center tabular-nums`}
            value={start}
            disabled={readOnly}
            onChange={(e) => e.target.value && setRows(setDayStart(rows, e.target.value))}
          />
        </label>
        <span className="text-sm text-ink-soft">→ {t('editor.endsAt', { time: end })}</span>
      </div>

      {hasGaps(rows) && !readOnly && (
        <Alert tone="info" className="mb-3">
          {t('editor.gaps')}
        </Alert>
      )}

      <div>
        {insertSlot(0)}
        {rows.map((r, i) => {
          if (r.type === 'period') periodNo += 1;
          const n = i + 1;
          const minutes = rowMinutes(r);
          const typeLabel = (v: TemplateRow['type']) => t(`editor.type.${v}`);
          const label = r.type === 'period' ? tc('periods.periodN', { n: periodNo }) : typeLabel(r.type);
          const dropping = drag && drag.to === i && drag.from !== i;
          return (
            <div key={i}>
              <div
                ref={(el) => {
                  rowEls.current[i] = el;
                }}
                data-testid="template-row"
                className={cx(
                  'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-2 py-2 md:px-3',
                  r.type !== 'period' ? 'bg-warning-soft' : 'bg-surface',
                  rowErrors(i) && 'ring-2 ring-danger',
                  drag?.from === i && 'opacity-50',
                  dropping && (drag.to > drag.from ? 'shadow-[0_3px_0_0_var(--brand)]' : 'shadow-[0_-3px_0_0_var(--brand)]'),
                )}
              >
                {!readOnly && (
                  <button
                    type="button"
                    data-drag-handle
                    aria-label={t('editor.move', { n })}
                    title={t('editor.move', { n })}
                    className="flex h-10 w-7 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded text-lg leading-none text-ink-muted hover:bg-white focus-visible:outline-2 focus-visible:outline-brand active:cursor-grabbing"
                    onKeyDown={(e) => onHandleKey(e, i)}
                    onPointerDown={(e) => onHandleDown(e, i)}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onPointerCancel={() => setDrag(null)}
                  >
                    ⋮⋮
                  </button>
                )}
                <strong className="w-[4.5rem] shrink-0 truncate text-sm tabular-nums">{label}</strong>
                <Select
                  size="sm"
                  className="w-[136px]"
                  aria-label={t('editor.rowType', { n })}
                  disabled={readOnly}
                  value={r.type}
                  options={ROW_TYPES.map((v) => ({ value: v, label: typeLabel(v) }))}
                  onChange={(type) => patchRow(i, { type })}
                />
                <span className="inline-flex h-10 items-center rounded-lg border border-line bg-white">
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label={t('editor.less', { n })}
                      className="h-full w-8 text-lg leading-none text-ink-soft hover:bg-surface disabled:opacity-30"
                      disabled={minutes <= MINUTES_STEP}
                      onClick={() => setRows(setRowMinutes(rows, i, minutes - MINUTES_STEP))}
                    >
                      −
                    </button>
                  )}
                  <input
                    inputMode="numeric"
                    aria-label={t('editor.minutes', { n })}
                    className="h-full w-11 border-x border-line text-center tabular-nums disabled:bg-transparent"
                    value={minutes}
                    disabled={readOnly}
                    onChange={(e) => {
                      const m = Number(e.target.value.replace(/\D/g, ''));
                      if (m > 0) setRows(setRowMinutes(rows, i, m));
                    }}
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label={t('editor.more', { n })}
                      className="h-full w-8 text-lg leading-none text-ink-soft hover:bg-surface"
                      onClick={() => setRows(setRowMinutes(rows, i, minutes + MINUTES_STEP))}
                    >
                      +
                    </button>
                  )}
                  <span className="px-2 text-xs text-ink-soft">{t('editor.minUnit')}</span>
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <span className="whitespace-nowrap text-sm tabular-nums text-ink-soft">
                    {r.start}–{r.end}
                  </span>
                  {!readOnly && <IconButton icon="close" size="sm" label={t('editor.remove', { n })} onClick={() => setRows(removeRow(rows, i))} />}
                </span>
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
              {i < rows.length - 1 && insertSlot(i + 1)}
            </div>
          );
        })}
      </div>

      <p className="mb-0 mt-3 text-sm text-ink-soft">
        {t('editor.summary', { start, end, periods: periods.length, teaching })}
      </p>

      {!readOnly && (
        <div className="mt-3 flex flex-wrap gap-4">
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
