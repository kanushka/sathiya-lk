// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import type { OverlayCell } from './reliefOverlay';

export function leaveText(cell: OverlayCell, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  if (!cell.onLeave) return null;
  return cell.onLeave.reliefBy ? t('teacher:leave.withRelief', { name: cell.onLeave.reliefBy }) : t('teacher:leave.noRelief');
}

export function CellNote({ cell, compact }: { cell: OverlayCell; compact?: boolean }) {
  const { t } = useTranslation('teacher');
  const leave = leaveText(cell, t);
  if (cell.relief) {
    return (
      <span className="flex flex-wrap items-center gap-1">
        <Badge tone="brand" className={compact ? 'h-[18px] px-1.5 text-[10px]' : undefined}>
          {t('relief.tag')}
        </Badge>
        <span className={compact ? 'text-[10px] text-ink-muted' : 'text-[13px] text-ink-muted'}>{t('relief.for', { name: cell.relief.forTeacher })}</span>
      </span>
    );
  }
  if (leave) return <span className={compact ? 'block text-[10px] font-semibold text-warning' : 'block text-[13px] font-semibold text-warning'}>{leave}</span>;
  return null;
}
