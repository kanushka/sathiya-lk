// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { call } from '../../lib/callable';

export type SetStatusFn = (req: { schoolId: string; status: 'active' | 'disabled' }) => Promise<unknown>;

export const defaultSetStatus: SetStatusFn = (req) => call('setSchoolStatus', req);
