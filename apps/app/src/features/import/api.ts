// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { ImportSetupReq, ImportSetupRes } from '@sathiya/core';
import { call } from '../../lib/callable';

// The SDK's 70s default would give up while the function (timeoutSeconds 300) is still creating accounts.
const TIMEOUT_MS = 310_000;

export function importSetup(req: ImportSetupReq): Promise<ImportSetupRes> {
  return call('importSetup', req, { timeout: TIMEOUT_MS });
}
