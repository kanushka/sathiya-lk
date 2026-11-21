// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { RouteObject } from 'react-router-dom';
import { PrintClassPage } from './PrintClassPage';
import { PrintTeacherPage } from './PrintTeacherPage';

export const routes: RouteObject[] = [
  { path: '/admin/print/class/:id', element: <PrintClassPage /> },
  { path: '/admin/print/teacher/:id', element: <PrintTeacherPage /> },
];
