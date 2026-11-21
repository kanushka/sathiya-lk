// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Lang } from '@sathiya/core';
import { httpsCallable } from 'firebase/functions';
import { toApiError } from '../../lib/callable';
import { functions } from '../../lib/firebase';

export interface SendAuthEmailReq {
  kind: 'verify' | 'reset';
  email?: string;
  lang: Lang;
}

export async function sendAuthEmail(req: SendAuthEmailReq): Promise<void> {
  try {
    await httpsCallable<SendAuthEmailReq, { ok: true }>(functions, 'sendAuthEmail')(req);
  } catch (err) {
    throw toApiError(err);
  }
}
