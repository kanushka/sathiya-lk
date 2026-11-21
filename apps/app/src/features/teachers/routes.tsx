import type { RouteObject } from 'react-router-dom';
import { TeachersPage } from './TeachersPage';

export const routes: RouteObject[] = [{ path: '/admin/teachers', element: <TeachersPage /> }];
