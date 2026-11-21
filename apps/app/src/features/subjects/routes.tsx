// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { RouteObject } from 'react-router-dom';
import { SubjectsPage } from './SubjectsPage';

export const routes: RouteObject[] = [{ path: '/admin/subjects', element: <SubjectsPage /> }];
