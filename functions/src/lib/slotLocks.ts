// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';

// Functions-only collection (not in core paths); clients have no access.
export const slotLocks = (sid: string, yid: string): string => `${paths.years(sid)}/${yid}/slotLocks`;
export const slotLock = (sid: string, yid: string, key: string): string => `${slotLocks(sid, yid)}/${key}`;
