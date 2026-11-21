// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { mkdirSync } from 'node:fs';
import { seed } from '../scripts/seed';
import { SHOTS } from './helpers';

export default async function globalSetup(): Promise<void> {
  mkdirSync(SHOTS, { recursive: true });
  await seed();
}
