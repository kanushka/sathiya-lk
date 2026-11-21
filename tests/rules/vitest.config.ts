// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['*.test.ts'], testTimeout: 30_000, hookTimeout: 30_000, fileParallelism: false },
});
