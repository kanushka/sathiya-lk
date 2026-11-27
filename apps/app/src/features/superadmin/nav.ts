// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { IconName } from '../../ui/Icon';

export interface SuperNavItem {
  to: string;
  labelKey: string;
  icon: IconName;
  end?: boolean;
}

export const superNav: SuperNavItem[] = [
  { to: '/super', labelKey: 'nav.schools', icon: 'school', end: true },
  { to: '/super/reports', labelKey: 'nav.reports', icon: 'flag' },
  { to: '/super/usage', labelKey: 'nav.usage', icon: 'chart' },
  { to: '/super/subjects', labelKey: 'nav.subjects', icon: 'subjects' },
  { to: '/super/terms', labelKey: 'nav.terms', icon: 'document' },
  { to: '/super/announcements', labelKey: 'nav.announcements', icon: 'megaphone' },
];
