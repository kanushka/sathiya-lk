// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { formatAmount, formatAmountPair, type Lang, type PinProgress } from '@sathiya/core';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';

export interface PinBarProps {
  title: string;
  detail?: string;
  color: string;
  progress: PinProgress;
  fullNote?: string;
  suggestedCount: number;
  onSuggest(): void;
  onPinSuggested(): void;
  onDone(): void;
}

export function PinBar({ title, detail, color, progress, fullNote, suggestedCount, onSuggest, onPinSuggested, onDone }: PinBarProps) {
  const { t, i18n } = useTranslation('timetable');
  const lang = i18n.language as Lang;
  const titleId = useId();
  const { placed, needed, left, over, unit } = progress;
  const amount = (n: number) => formatAmount(n, unit, lang);
  const base = t('pin.progress', { placed: amount(placed), needed: amount(needed) });
  const text = over > 0 ? base : `${base} · ${left > 0 ? t('pin.toGo', { amount: amount(left) }) : fullNote || t('pin.complete')}`;
  const max = Math.max(needed, placed, 1);
  const pct = Math.round((Math.min(placed, needed || placed) / max) * 100);

  return (
    <section
      aria-labelledby={titleId}
      className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 bg-brand px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 text-on-brand shadow-[0_14px_30px_-18px_rgba(20,33,61,.6)] md:sticky md:inset-x-auto md:bottom-auto md:top-0 md:z-20 md:mb-3.5 md:gap-3.5 md:rounded-[14px] md:py-3"
    >
      <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded border border-on-brand/40" style={{ background: color }} />
      <div className="min-w-0 flex-1 md:flex-[1_1_240px]">
        <p id={titleId} className="m-0 flex items-center gap-1.5 text-xs font-semibold">
          <Icon name="pin" size={13} strokeWidth={2} />
          {t('pin.mode')}
        </p>
        <p className="m-0 mt-0.5 truncate text-base font-bold md:whitespace-normal">{title}</p>
        {detail && <p className="m-0 mt-0.5 truncate text-xs text-on-brand/80 md:whitespace-normal">{detail}</p>}
      </div>
      <div className="flex flex-col gap-1 md:min-w-[170px]">
        <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
          <span>{text}</span>
          {over > 0 && <Badge tone="danger">{t('pin.over', { amount: amount(over) })}</Badge>}
        </span>
        <span
          role="meter"
          aria-label={t('pin.progressLabel')}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={placed}
          aria-valuetext={formatAmountPair(placed, needed, unit, lang)}
          data-over={over > 0 || undefined}
          className="relative hidden h-1.5 overflow-hidden rounded-full bg-on-brand/25 md:block md:w-[170px]"
        >
          <span className="absolute inset-y-0 left-0 block bg-on-brand" style={{ width: `${pct}%` }} />
          {over > 0 && <span className="absolute inset-y-0 right-0 block bg-fill-over" style={{ width: `${100 - pct}%` }} />}
        </span>
      </div>
      <div className="flex w-full gap-2 md:w-auto md:flex-wrap">
        {left > 0 && suggestedCount === 0 && (
          <Button variant="onBrand" onClick={onSuggest} className="flex-1 md:flex-none">
            {unit === 'minutes' ? t('pin.suggestTime', { amount: amount(left) }) : t('pin.suggest', { count: left })}
          </Button>
        )}
        {suggestedCount > 0 && (
          <Button onClick={onPinSuggested} className="flex-1 md:flex-none">
            <Icon name="pin" size={16} strokeWidth={2} />
            {t('pin.pinSuggested', { count: suggestedCount })}
          </Button>
        )}
        <Button variant="onBrand" onClick={onDone} className="flex-1 md:flex-none">
          <Icon name="check" size={16} strokeWidth={2} />
          {t('pin.done')}
        </Button>
      </div>
    </section>
  );
}
