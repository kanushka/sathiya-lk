// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { Navigate, type RouteObject } from 'react-router-dom';
import { MePage } from './MePage';
import { MyClassPage } from './MyClassPage';
import { PrintMyClassPage, PrintMyTimetablePage } from './PrintMine';
import { TeacherShell } from './TeacherShell';
import { TimetablePage } from './TimetablePage';
import { TodayPage } from './TodayPage';

export const routes: RouteObject[] = [
  {
    path: '/me',
    element: <TeacherShell />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'timetable', element: <TimetablePage /> },
      { path: 'class', element: <MyClassPage /> },
      { path: 'profile', element: <MePage /> },
      { path: 'week', element: <Navigate to="../timetable" replace /> },
    ],
  },
  { path: '/me/print/timetable', element: <PrintMyTimetablePage /> },
  { path: '/me/print/class/:id', element: <PrintMyClassPage /> },
];
