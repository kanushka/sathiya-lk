// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { CancelInviteRes, InviteAdminRes, RemoveAdminRes } from '@sathiya/core';
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

export function cancelInvite(schoolId: string, email: string): Promise<CancelInviteRes> {
  return call('cancelInvite', { schoolId, email });
}

export function removeAdmin(schoolId: string, uid: string): Promise<RemoveAdminRes> {
  return call('removeAdmin', { schoolId, uid });
}
