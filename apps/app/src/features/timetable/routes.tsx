// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { RouteObject } from 'react-router-dom';
import { ClassIndexRedirect, ClassViewPage } from './ClassViewPage';
import { TeacherIndexRedirect, TeacherViewPage } from './TeacherViewPage';

export const routes: RouteObject[] = [
  { path: '/admin/timetable/class', element: <ClassIndexRedirect /> },
  { path: '/admin/timetable/class/:classId', element: <ClassViewPage /> },
  { path: '/admin/timetable/teacher', element: <TeacherIndexRedirect /> },
  { path: '/admin/timetable/teacher/:teacherId', element: <TeacherViewPage /> },
];
