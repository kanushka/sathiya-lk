// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { TFunction } from 'i18next';
import { toApiError } from '../../lib/callable';

export function accountActionError(err: unknown, t: TFunction): string {
  const e = toApiError(err);
  switch (e.code) {
    case 'already-linked':
      return t((e.details as { reason?: unknown } | undefined)?.reason === 'account' ? 'teachers:page.accountLinked' : 'teachers:page.alreadyLinked');
    case 'too-many-schools':
      return t('teachers:page.tooManySchools');
    case 'rate-limited':
      return t('teachers:page.rateLimited');
    case 'school-disabled':
      return t('shell:suspended.writeBlocked');
    default:
      return t('teachers:page.actionFailed');
  }
}
