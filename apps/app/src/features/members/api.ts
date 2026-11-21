// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { InviteAdminRes } from '@sathiya/core';
import { call } from '../../lib/callable';

export interface Invite {
  id: string;
  email: string;
  teacherId?: string;
  createdAt?: number;
}

export function inviteAdmin(schoolId: string, email: string, teacherId?: string): Promise<InviteAdminRes> {
  return call('inviteAdmin', { schoolId, email: email.trim(), ...(teacherId ? { teacherId } : {}) });
}
