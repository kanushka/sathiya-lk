// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      {icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--brand)_10%,white)] text-brand">
          <Icon name={icon} size={26} />
        </span>
      )}
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {body && <div className="mt-2 text-sm text-ink-muted">{body}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
