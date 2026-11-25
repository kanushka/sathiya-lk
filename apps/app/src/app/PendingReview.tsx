// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '../lib/callable';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { Icon } from '../ui/Icon';
import { useSchool } from './SchoolProvider';

export const isSchoolPendingError = (err: unknown): boolean => toApiError(err).code === 'school-pending';

export function useSchoolPending(): boolean {
  return useSchool().school.status === 'pending';
}

export function PendingBanner() {
  const { t } = useTranslation('shell');
  if (!useSchoolPending()) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-warning-line bg-warning-soft px-4 py-3 text-sm leading-normal md:px-6"
    >
      <Badge tone="warning" dot className="bg-white">
        {t('review.badge')}
      </Badge>
      <span className="min-w-0 flex-[1_1_480px]">
        <strong>{t('review.bannerTitle')}</strong> <span className="text-ink-soft">{t('review.bannerBody')}</span>
      </span>
    </div>
  );
}

export function PendingNote({ id, text, className }: { id?: string; text?: string; className?: string }) {
  const { t } = useTranslation('shell');
  return (
    <p id={id} className={cx('m-0 inline-flex items-center gap-1.5 text-xs text-ink-muted', className)}>
      <Icon name="lock" size={13} strokeWidth={2} />
      {text ?? t('review.locked')}
    </p>
  );
}

export function LockedButton({ children }: { children: ReactNode }) {
  const { t } = useTranslation('shell');
  const id = useId();
  return (
    <>
      <Button disabled title={t('review.locked')} aria-describedby={id}>
        <Icon name="lock" size={14} strokeWidth={2} />
        {children}
      </Button>
      <span id={id} className="sr-only">
        {t('review.locked')}
      </span>
    </>
  );
}
