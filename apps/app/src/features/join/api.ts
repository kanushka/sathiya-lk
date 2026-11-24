// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { JoinSchoolRes } from '@sathiya/core';
import { call } from '../../lib/callable';

export interface JoinTarget {
  sid?: string;
  token: string;
}

export function joinSchool(target: JoinTarget, staffId?: string): Promise<JoinSchoolRes> {
  return call('joinSchool', {
    token: target.token,
    ...(target.sid ? { schoolId: target.sid } : {}),
    ...(staffId ? { staffId } : {}),
  });
}
