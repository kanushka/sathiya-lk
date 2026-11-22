// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { ImportSetupReq, ImportSetupRes } from '@sathiya/core';
import { call } from '../../lib/callable';

export function importSetup(req: ImportSetupReq): Promise<ImportSetupRes> {
  return call('importSetup', req);
}
