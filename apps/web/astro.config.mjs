// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sathiya.lk',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
