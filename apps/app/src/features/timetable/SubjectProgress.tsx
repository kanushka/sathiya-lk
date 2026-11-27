// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { classPlacement, formatAmountPair, formatSummaryAmount, placementSummary, type Entry, type PlanItem, type SchoolClass } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { cx } from '../../ui/cx';
import { IconButton } from '../../ui/IconButton';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { planItemColor, planItemName } from './labels';

export interface SubjectProgressProps {
  cls: SchoolClass;
  entries: Entry[];
  onPin?(item: PlanItem): void;
  onStop?(): void;
  activeKey?: string;
  /** Rows only, for a fold that already shows the title and total. */
  headless?: boolean;
}

export function SubjectProgress({ cls, entries, onPin, onStop, activeKey, headless = false }: SubjectProgressProps) {
  const { t } = useTranslation('timetable');
  const { lang } = useLang();
  const ctx = useSchool();
  const { rows } = classPlacement(cls, entries, ctx);
  const summary = placementSummary(rows);

  const list = (
      <ul className="m-0 list-none p-0">
        {rows.map((r) => {
          const done = r.placed >= r.needed;
          const over = r.placed > r.needed;
          const pct = r.needed > 0 ? Math.min(100, Math.round((r.placed / r.needed) * 100)) : 100;
          const active = r.key === activeKey;
          const name = planItemName(r.item, ctx, lang);
          return (
            <li
              key={r.key}
              data-active={active || undefined}
              className={cx('-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-[5px]', active && 'bg-brand/10 shadow-[inset_0_0_0_1.5px_var(--brand)]')}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: planItemColor(r.item, ctx) }} />
              <span className="flex-1 text-[13px]">{name}</span>
              <span className="h-1.5 w-[70px] overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                <span data-bar className={cx('block h-1.5', over ? 'bg-danger' : done ? 'bg-fill-success' : 'bg-fill-warning')} style={{ width: `${pct}%` }} />
              </span>
              <b data-over={over || undefined} className={cx('min-w-9 whitespace-nowrap text-right text-[13px]', over ? 'text-danger' : done ? 'text-success' : 'text-warning')}>
                {t('progress.count', { progress: formatAmountPair(r.placed, r.needed, r.unit, lang) })}
              </b>
              {onPin && (
                <span className="flex w-9 shrink-0 justify-end">
                  <IconButton
                    data-pin-key={r.key}
                    icon={active ? 'check' : 'pin'}
                    label={active ? t('pin.listStop', { subject: name }) : t('pin.listPin', { subject: name })}
                    variant={active ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => (active ? onStop?.() : onPin(r.item))}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ul>
  );
  if (headless) return list;
  return (
    <section className="rounded-[14px] border border-line bg-white p-4">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="m-0 text-[15px] font-bold">{t('progress.title', { class: cls.name })}</h2>
        <span className="text-[13px] text-ink-muted">
          <b className="text-ink">{formatSummaryAmount(summary.placed, summary, lang)}</b>{' '}
          <span>{t('progress.placedOf', { total: formatSummaryAmount(summary.needed, summary, lang) })}</span>
        </span>
      </div>
      {list}
    </section>
  );
}
