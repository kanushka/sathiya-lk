// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { CallableTypes } from '@sathiya/core';
import { call } from '../../lib/callable';

export async function sendAuthEmail(req: CallableTypes['sendAuthEmail']['req']): Promise<void> {
  await call('sendAuthEmail', req);
}
