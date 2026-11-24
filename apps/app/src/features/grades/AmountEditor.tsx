// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { PlanItem } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../ui/cx';
import { inputBareCompactClass } from '../../ui/Field';
import { applyAmount, type Amount } from './planModel';

interface NumInputProps {
  label: string;
  value: number | undefined;
  disabled: boolean;
  width?: string;
  allowEmpty?: boolean;
  onCommit: (n: number | null) => void;
}

function NumInput({ label, value, disabled, width = 'w-14', allowEmpty, onCommit }: NumInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (text === '' && allowEmpty) {
      if (value !== undefined) onCommit(null);
      return;
    }
    if (!/^\d+$/.test(text)) return;
    const n = Number(text);
    if (n !== value) onCommit(n);
  }

  return (
    <input
      type="number"
      min={0}
      aria-label={label}
      value={draft ?? value ?? ''}
      disabled={disabled}
      className={cx(inputBareCompactClass, 'h-9 text-center font-bold', width)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}

export interface AmountEditorProps {
  item: Pick<PlanItem, 'perWeek' | 'unit' | 'perDay'>;
  name?: string;
  disabled: boolean;
  onChange: (next: Amount) => void;
}

export function AmountEditor({ item, name, disabled, onChange }: AmountEditorProps) {
  const { t } = useTranslation('grades');
  const minutes = item.unit === 'minutes';
  const label = (key: string) => (name ? t(`amount.${key}For`, { name }) : t(`amount.${key}`));
  const hours = Math.floor(item.perWeek / 60);
  const rest = item.perWeek % 60;
  const toggle = (unit: 'periods' | 'minutes') =>
    unit === 'minutes' ? onChange({ unit: 'minutes', perWeek: 0 }) : onChange({ perWeek: 1 });
  const btn = (unit: 'periods' | 'minutes', text: string, aria: string) => (
    <button
      type="button"
      aria-pressed={(unit === 'minutes') === minutes}
      aria-label={aria}
      disabled={disabled}
      onClick={() => ((unit === 'minutes') !== minutes ? toggle(unit) : undefined)}
      className={cx(
        'h-9 px-2.5 text-xs font-semibold first:rounded-l-lg last:rounded-r-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        (unit === 'minutes') === minutes ? 'bg-brand text-on-brand' : 'bg-white text-ink-soft hover:bg-surface',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {text}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label={label('unit')} className="flex overflow-hidden rounded-lg border border-line-strong">
        {btn('periods', t('amount.periods'), label('periodsUnit'))}
        {btn('minutes', t('amount.time'), label('timeUnit'))}
      </div>
      {minutes ? (
        <>
          <NumInput
            label={label('hours')}
            value={hours}
            disabled={disabled}
            onCommit={(h) => onChange({ unit: 'minutes', perWeek: (h ?? 0) * 60 + rest })}
          />
          <span className="text-[13px] text-ink-soft">{t('amount.hShort')}</span>
          <NumInput
            label={label('minutes')}
            value={rest}
            disabled={disabled}
            onCommit={(m) => onChange({ unit: 'minutes', perWeek: hours * 60 + (m ?? 0) })}
          />
          <span className="text-[13px] text-ink-soft">{t('amount.minShort')}</span>
          <NumInput
            label={label('perDay')}
            value={item.perDay}
            disabled={disabled}
            allowEmpty
            width="w-16"
            onCommit={(d) => onChange(d === null || d === 0 ? { unit: 'minutes', perWeek: item.perWeek } : { unit: 'minutes', perWeek: d * 5, perDay: d })}
          />
          <span className="text-[13px] text-ink-soft">{t('amount.perDayShort')}</span>
        </>
      ) : (
        <>
          <NumInput
            label={name ? t('plan.perWeekFor', { name }) : t('group.perWeek')}
            value={item.perWeek}
            disabled={disabled}
            onCommit={(n) => onChange({ perWeek: n ?? 0 })}
          />
          <span className="text-[13px] text-ink-soft">{t('plan.perWeek')}</span>
        </>
      )}
    </div>
  );
}
