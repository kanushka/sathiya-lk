// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Candidate } from '@sathiya/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { focusRingClass } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { Icon } from '../../ui/Icon';
import { Modal } from '../../ui/Modal';
import type { Names } from './model';

export interface ReliefPickerProps {
  lesson: string;
  absentName: string;
  candidates: Candidate[];
  current: string | null;
  names: Names;
  onPick(teacherId: string | null): void;
  onClose(): void;
}

function Option({ selected, onClick, children }: { selected: boolean; onClick(): void; children: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={cx(
          'flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left',
          focusRingClass,
          selected ? 'border-brand bg-brand/5' : 'border-line-soft bg-white hover:bg-surface',
        )}
      >
        <span className="min-w-0 flex-1">{children}</span>
        {selected && <Icon name="check" size={18} className="shrink-0 text-brand" />}
      </button>
    </li>
  );
}

export function ReliefPicker({ lesson, absentName, candidates, current, names, onPick, onClose }: ReliefPickerProps) {
  const { t } = useTranslation('relief');
  const stale = current !== null && !candidates.some((c) => c.teacherId === current);
  const pick = (id: string | null) => {
    onPick(id);
    onClose();
  };

  const tags = (c: Candidate) => [
    ...(c.teachesClass ? [{ label: t('picker.teachesClass'), fit: true }] : []),
    ...(c.teachesSubject ? [{ label: t('picker.teachesSubject'), fit: true }] : []),
    { label: t('picker.yearCount', { count: c.yearCount }), fit: false },
    { label: c.noLessonsToday ? t('picker.noLessonsToday') : t('picker.todayCount', { count: c.todayCount }), fit: false },
  ];

  return (
    <Modal open title={t('picker.title')} subtitle={`${lesson} · ${t('reliefs.for', { name: absentName })}`} onClose={onClose} width={480}>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {stale && (
          <Option selected onClick={() => pick(current)}>
            <strong className="block text-sm text-ink">{names.teacher(current)}</strong>
            <Badge tone="danger" className="mt-1">{t('picker.notAvailable')}</Badge>
          </Option>
        )}
        {candidates.map((c) => (
          <Option key={c.teacherId} selected={c.teacherId === current} onClick={() => pick(c.teacherId)}>
            <strong className="block text-sm text-ink">{names.teacher(c.teacherId)}</strong>
            <span className="mt-1 flex flex-wrap gap-1">
              {tags(c).map((tag) => (
                <Badge key={tag.label} tone={tag.fit ? 'brand' : 'neutral'}>
                  {tag.label}
                </Badge>
              ))}
            </span>
          </Option>
        ))}
        {candidates.length === 0 && <li className="px-1 py-2 text-sm text-ink-muted">{t('picker.noneFree')}</li>}
        <Option selected={current === null} onClick={() => pick(null)}>
          <span className="flex items-center gap-2 text-sm font-semibold text-warning">
            <Icon name="minus" size={16} />
            {t('picker.uncovered')}
          </span>
        </Option>
      </ul>
    </Modal>
  );
}
