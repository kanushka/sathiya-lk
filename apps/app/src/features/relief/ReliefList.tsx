// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Candidate, Relief } from '@sathiya/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { Button, focusRingClass } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { fieldBaseClass } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { reliefKey, type Names } from './model';
import { ReliefPicker } from './ReliefPicker';

export interface ReliefListProps {
  reliefs: Relief[];
  names: Names;
  readOnly: boolean;
  candidatesOf(index: number): Candidate[];
  errorsOf(r: Relief): string[];
  status(r: Relief): ReactNode;
  onPick(index: number, teacherId: string | null): void;
  onSuggest(): void;
}

export function ReliefList({ reliefs, names, readOnly, candidatesOf, errorsOf, status, onPick, onSuggest }: ReliefListProps) {
  const { t } = useTranslation('relief');
  const [open, setOpen] = useState<number | null>(null);
  const openRelief = open === null ? undefined : reliefs[open];

  return (
    <section aria-labelledby="relief-list-title" className="rounded-[14px] border border-line-soft bg-white p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="relief-list-title" className="m-0 text-[17px] font-bold text-ink">
          {t('reliefs.title')}
        </h2>
        {!readOnly && (
          <Button variant="secondary" size="sm" onClick={onSuggest} disabled={reliefs.length === 0}>
            {t('reliefs.suggest')}
          </Button>
        )}
      </div>

      {reliefs.length === 0 ? (
        <p className="m-0 text-sm text-ink-muted">{readOnly ? t('reliefs.nonePast') : t('reliefs.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {reliefs.map((r, i) => {
            const lesson = names.lesson(r);
            const tid = r.reliefTeacherId;
            const picked = tid === null ? t('reliefs.uncovered') : names.teacher(tid);
            const unavailable = !readOnly && tid !== null && !candidatesOf(i).some((c) => c.teacherId === tid);
            const errors = errorsOf(r);
            return (
              <li key={reliefKey(r)} className="flex flex-col gap-2 border-t border-line-soft py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 sm:flex-1">
                  <strong className="block text-sm text-ink">{lesson}</strong>
                  <span className="text-[13px] text-ink-muted">{t('reliefs.for', { name: names.teacher(r.absentTeacherId) })}</span>
                </div>
                <div className="flex flex-col gap-1 sm:w-72 sm:shrink-0">
                  {readOnly ? (
                    <span className={cx('text-sm font-semibold', tid === null ? 'text-warning' : 'text-ink')}>{picked}</span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`${t('reliefs.pickFor', { lesson })}: ${picked}`}
                      aria-haspopup="dialog"
                      aria-invalid={errors.length > 0 || unavailable || undefined}
                      onClick={() => setOpen(i)}
                      className={cx(fieldBaseClass, focusRingClass, 'flex h-11 items-center gap-2 text-left')}
                    >
                      {tid === null && <Icon name="minus" size={16} className="shrink-0 text-warning" />}
                      <span className={cx('min-w-0 flex-1 truncate', tid === null && 'font-semibold text-warning')}>{picked}</span>
                      <Icon name="chevronDown" size={16} className="shrink-0 text-ink-muted" />
                    </button>
                  )}
                  <span className="flex flex-wrap gap-1.5">
                    {unavailable && <Badge tone="danger">{t('reliefs.notAvailable')}</Badge>}
                    {status(r)}
                  </span>
                  {errors.map((e) => (
                    <span key={e} className="text-[13px] font-semibold text-danger">
                      {e}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open !== null && openRelief && (
        <ReliefPicker
          lesson={names.lesson(openRelief)}
          absentName={names.teacher(openRelief.absentTeacherId)}
          candidates={candidatesOf(open)}
          current={openRelief.reliefTeacherId}
          names={names}
          onPick={(id) => onPick(open, id)}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
