// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

// `//host` and `/\host` are network-path references: a router link to them leaves the app.
export const isAppPath = (path: unknown): path is string =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
