// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { PinProgress } from '@sathiya/core';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';

export interface PinBarProps {
  subject: string;
  teacher: string;
  color: string;
  progress: PinProgress;
  suggestedCount: number;
  onSuggest(): void;
  onPinSuggested(): void;
  onDone(): void;
}

export function PinBar({ subject, teacher, color, progress, suggestedCount, onSuggest, onPinSuggested, onDone }: PinBarProps) {
  const { t } = useTranslation('timetable');
  const titleId = useId();
  const { placed, needed, left, over } = progress;
  const base = t('pin.progress', { placed, needed });
  const text = over > 0 ? base : `${base} · ${left > 0 ? t('pin.toGo', { count: left }) : t('pin.complete')}`;
  const max = Math.max(needed, placed, 1);
  const pct = Math.round((Math.min(placed, needed || placed) / max) * 100);

  return (
    <section
      aria-labelledby={titleId}
      className="sticky top-0 z-20 mb-3.5 flex flex-wrap items-center gap-3.5 rounded-[14px] bg-brand px-4 py-3 text-on-brand shadow-[0_14px_30px_-18px_rgba(20,33,61,.6)]"
    >
      <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded border border-on-brand/40" style={{ background: color }} />
      <div className="min-w-0 flex-[1_1_240px]">
        <p id={titleId} className="m-0 flex items-center gap-1.5 text-xs font-semibold">
          <Icon name="pin" size={13} strokeWidth={2} />
          {t('pin.mode')}
        </p>
        <p className="m-0 mt-0.5 text-base font-bold">{t('pin.target', { subject, teacher })}</p>
      </div>
      <div className="flex min-w-[170px] flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
          <span>{text}</span>
          {over > 0 && <Badge tone="danger">{t('pin.over', { count: over })}</Badge>}
        </span>
        <span
          role="meter"
          aria-label={t('pin.progressLabel')}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={placed}
          aria-valuetext={`${placed}/${needed}`}
          data-over={over > 0 || undefined}
          className="relative block h-1.5 w-[170px] overflow-hidden rounded-full bg-on-brand/25"
        >
          <span className="absolute inset-y-0 left-0 block bg-on-brand" style={{ width: `${pct}%` }} />
          {over > 0 && <span className="absolute inset-y-0 right-0 block bg-fill-over" style={{ width: `${100 - pct}%` }} />}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {left > 0 && suggestedCount === 0 && (
          <Button variant="onBrand" onClick={onSuggest}>
            {t('pin.suggest', { count: left })}
          </Button>
        )}
        {suggestedCount > 0 && (
          <Button onClick={onPinSuggested}>
            <Icon name="pin" size={16} strokeWidth={2} />
            {t('pin.pinSuggested', { count: suggestedCount })}
          </Button>
        )}
        <Button variant="onBrand" onClick={onDone}>
          <Icon name="check" size={16} strokeWidth={2} />
          {t('pin.done')}
        </Button>
      </div>
    </section>
  );
}
