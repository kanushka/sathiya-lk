// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ReactNode } from 'react';
import { cx } from './cx';

export type AlertTone = 'danger' | 'warning' | 'success' | 'info';

const tones: Record<AlertTone, string> = {
  danger: 'border-danger-line bg-danger-soft text-danger',
  warning: 'border-warning-line bg-warning-soft text-warning',
  success: 'border-success-line bg-success-soft text-success',
  info: 'border-line bg-surface text-ink',
};

export interface AlertProps {
  tone: AlertTone;
  children: ReactNode;
  role?: 'alert' | 'status';
  className?: string;
}

export function Alert({ tone, children, role, className }: AlertProps) {
  return (
    <div
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
      className={cx('rounded-lg border px-4 py-3 text-sm font-semibold', tones[tone], className)}
    >
      {children}
    </div>
  );
}
