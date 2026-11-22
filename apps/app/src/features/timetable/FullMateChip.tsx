// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useTranslation } from 'react-i18next';
import { ToggleChip } from '../../ui/Chip';

export function FullMateChip({ name, placed, needed }: { name: string; placed: number; needed: number }) {
  const { t } = useTranslation('timetable');
  return (
    <ToggleChip pressed={false} disabled onToggle={() => {}}>
      {t('pin.classFull', { class: name, placed, needed })}
    </ToggleChip>
  );
}
