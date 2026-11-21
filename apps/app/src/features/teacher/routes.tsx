// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { RouteObject } from 'react-router-dom';
import { TodayPage } from './TodayPage';
import { WeekPage } from './WeekPage';

export const routes: RouteObject[] = [
  { path: '/me', element: <TodayPage /> },
  { path: '/me/week', element: <WeekPage /> },
];
