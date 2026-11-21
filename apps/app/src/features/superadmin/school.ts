// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { School } from '@sathiya/core';

// Until core's School gains city/address/phone (Phase 6); city is optional because older docs lack it.
export type SchoolRecord = School & { city?: string; address?: string; phone?: string };
