// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { JoinTarget } from './api';

const SID = /^[A-Za-z0-9_-]{1,64}$/;
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

export function isWellFormed({ sid, token }: JoinTarget): boolean {
  return TOKEN.test(token) && (sid === undefined || SID.test(sid));
}
