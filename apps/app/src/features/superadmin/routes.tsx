// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { RouteObject } from 'react-router-dom';
import { AnnouncementsPage } from './AnnouncementsPage';
import { DefaultSubjectsPage } from './DefaultSubjectsPage';
import { SchoolDetail } from './SchoolDetail';
import { SchoolsPage } from './SchoolsPage';
import { SuperLayout } from './SuperLayout';
import { TermsPage } from './TermsPage';
import { UsagePage } from './UsagePage';

export const routes: RouteObject[] = [
  { path: '/super', element: <SuperLayout><SchoolsPage /></SuperLayout> },
  { path: '/super/schools/:sid', element: <SuperLayout><SchoolDetail /></SuperLayout> },
  { path: '/super/usage', element: <SuperLayout><UsagePage /></SuperLayout> },
  { path: '/super/subjects', element: <SuperLayout><DefaultSubjectsPage /></SuperLayout> },
  { path: '/super/terms', element: <SuperLayout><TermsPage /></SuperLayout> },
  { path: '/super/announcements', element: <SuperLayout><AnnouncementsPage /></SuperLayout> },
];
