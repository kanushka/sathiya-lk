// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { RouteObject } from 'react-router-dom';
import { ProfilePage } from './ProfilePage';

export const routes: RouteObject[] = [{ path: '/admin/profile', element: <ProfilePage /> }];
