// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ReactNode } from 'react';
import { Badge } from './Badge';
import { PHONE_QUERY, useMediaQuery } from './PhoneNotice';

export interface PageHeaderProps {
  title: ReactNode;
  count?: number;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** On phones these replace `actions`: one primary action, plus an ActionMenu for the rest. */
  phoneActions?: ReactNode;
}

export function PageHeader({ title, count, subtitle, actions, phoneActions }: PageHeaderProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  if (isPhone && phoneActions !== undefined) {
    return (
      <header data-testid="page-header" className="mb-4">
        <div className="flex min-h-11 items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <h1 className="m-0 truncate text-[22px] font-bold text-ink">{title}</h1>
            {count !== undefined && <Badge>{count}</Badge>}
          </div>
          {phoneActions && <div className="flex shrink-0 items-center gap-2">{phoneActions}</div>}
        </div>
        {subtitle && <p className="mb-0 mt-1.5 text-[13px] leading-snug text-ink-soft">{subtitle}</p>}
      </header>
    );
  }
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
