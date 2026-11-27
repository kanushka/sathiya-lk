// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { DecideNameChangeReq } from '@sathiya/core';
import { call } from '../../lib/callable';

export type DecideNameFn = (req: DecideNameChangeReq) => Promise<unknown>;

export const defaultDecideName: DecideNameFn = (req) => call('decideNameChange', req);
