// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { PlanItem } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../ui/cx';
import { inputBareCompactClass } from '../../ui/Field';
import { SegmentedControl } from '../../ui/SegmentedControl';
import type { Amount } from './planModel';

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
  onPendingChange?: (pending: boolean) => void;
}

export function AmountEditor({ item, name, disabled, onChange, onPendingChange }: AmountEditorProps) {
  const { t } = useTranslation('grades');
  const [pending, setPending] = useState<'periods' | 'minutes' | null>(null);
  const stored = item.unit === 'minutes' ? 'minutes' : 'periods';
  const minutes = (pending ?? stored) === 'minutes';
  const derived = !pending && minutes && item.perDay !== undefined;
  const label = (key: string) => (name ? t(`amount.${key}For`, { name }) : t(`amount.${key}`));
  const hours = pending ? undefined : Math.floor(item.perWeek / 60);
  const rest = pending ? undefined : item.perWeek % 60;
  const emit = (next: Amount) => {
    if (pending && next.perWeek <= 0) return;
    setPending(null);
    onPendingChange?.(false);
    onChange(next);
  };
  const choose = (unit: 'periods' | 'minutes') => {
    const next = unit === stored ? null : unit;
    setPending(next);
    onPendingChange?.(next !== null);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        size="sm"
        aria-label={label('unit')}
        value={minutes ? 'minutes' : 'periods'}
        disabled={disabled}
        onChange={choose}
        options={[
          { value: 'periods', label: t('amount.periods'), ariaLabel: label('periodsUnit') },
          { value: 'minutes', label: t('amount.time'), ariaLabel: label('timeUnit') },
        ]}
      />
      {minutes ? (
        <>
          <NumInput
            label={label('hours')}
            value={hours}
            disabled={disabled || derived}
            onCommit={(h) => emit({ unit: 'minutes', perWeek: (h ?? 0) * 60 + (rest ?? 0) })}
          />
          <span className="text-[13px] text-ink-soft">{t('amount.hShort')}</span>
          <NumInput
            label={label('minutes')}
            value={rest}
            disabled={disabled || derived}
            onCommit={(m) => emit({ unit: 'minutes', perWeek: (hours ?? 0) * 60 + (m ?? 0) })}
          />
          <span className="text-[13px] text-ink-soft">{t('amount.minShort')}</span>
          <NumInput
            label={label('perDay')}
            value={pending ? undefined : item.perDay}
            disabled={disabled}
            allowEmpty
            width="w-16"
            onCommit={(d) => emit(d === null || d === 0 ? { unit: 'minutes', perWeek: pending ? 0 : item.perWeek } : { unit: 'minutes', perWeek: d * 5, perDay: d })}
          />
          <span className="text-[13px] text-ink-soft">{t('amount.perDayShort')}</span>
        </>
      ) : (
        <>
          <NumInput
            label={name ? t('plan.perWeekFor', { name }) : t('group.perWeek')}
            value={pending ? undefined : item.perWeek}
            disabled={disabled}
            onCommit={(n) => emit({ perWeek: n ?? 0 })}
          />
          <span className="text-[13px] text-ink-soft">{t('plan.perWeek')}</span>
        </>
      )}
    </div>
  );
}
