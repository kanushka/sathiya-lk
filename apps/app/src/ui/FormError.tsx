// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ReactNode } from 'react';
import { cx } from './cx';

export function FormError({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className={cx('text-sm font-medium text-danger', className)}>
      {children}
    </p>
  );
}
