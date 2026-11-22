// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ReactNode } from 'react';
import { Badge } from './Badge';

export interface PageHeaderProps {
  title: ReactNode;
  count?: number;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, count, subtitle, actions }: PageHeaderProps) {
  return (
    <header data-testid="page-header" className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="m-0 text-2xl font-bold text-ink">{title}</h1>
          {count !== undefined && <Badge>{count}</Badge>}
        </div>
        {subtitle && <p className="mb-0 mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}
