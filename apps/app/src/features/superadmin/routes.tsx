import type { RouteObject } from 'react-router-dom';
import { SchoolDetail } from './SchoolDetail';
import { SchoolsPage } from './SchoolsPage';
import { SuperLayout } from './SuperLayout';
import { UsagePage } from './UsagePage';

export const routes: RouteObject[] = [
  { path: '/super', element: <SuperLayout><SchoolsPage /></SuperLayout> },
  { path: '/super/schools/:sid', element: <SuperLayout><SchoolDetail /></SuperLayout> },
  { path: '/super/usage', element: <SuperLayout><UsagePage /></SuperLayout> },
];
