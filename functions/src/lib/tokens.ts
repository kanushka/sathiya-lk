// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { createHash, randomBytes } from 'node:crypto';

export const newToken = (): string => randomBytes(16).toString('base64url');

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
