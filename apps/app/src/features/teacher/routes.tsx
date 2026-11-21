import type { RouteObject } from 'react-router-dom';
import { TodayPage } from './TodayPage';
import { WeekPage } from './WeekPage';

export const routes: RouteObject[] = [
  { path: '/me', element: <TodayPage /> },
  { path: '/me/week', element: <WeekPage /> },
];
