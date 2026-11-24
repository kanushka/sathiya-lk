// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { formatAmountPair, type Lang } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { ToggleChip } from '../../ui/Chip';

export function FullMateChip({ name, placed, needed, unit }: { name: string; placed: number; needed: number; unit: 'periods' | 'minutes' }) {
  const { t, i18n } = useTranslation('timetable');
  return (
    <ToggleChip pressed={false} disabled onToggle={() => {}}>
      {t('pin.classFull', { class: name, progress: formatAmountPair(placed, needed, unit, i18n.language as Lang) })}
    </ToggleChip>
  );
}
