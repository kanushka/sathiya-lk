// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { RouteObject } from 'react-router-dom';
import { ClassIndexRedirect, ClassViewPage } from './ClassViewPage';

export const routes: RouteObject[] = [
  { path: '/admin/timetable/class', element: <ClassIndexRedirect /> },
  { path: '/admin/timetable/class/:classId', element: <ClassViewPage /> },
];
