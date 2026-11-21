// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { TFunction } from 'i18next';

export function errorMessage(t: TFunction<'superadmin'>, err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === 'not-allowed' || code === 'permission-denied' || code === 'unauthenticated') return t('errors.denied');
  return t('errors.generic');
}
