// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { RouteObject } from 'react-router-dom';
import { JoinPage } from './JoinPage';

export const routes: RouteObject[] = [
  { path: '/join/t/:token', element: <JoinPage /> },
  { path: '/join/:sid/:token', element: <JoinPage /> },
];
