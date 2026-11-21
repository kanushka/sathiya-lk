import type { RouteObject } from 'react-router-dom';
import { SubjectsPage } from './SubjectsPage';

export const routes: RouteObject[] = [{ path: '/admin/subjects', element: <SubjectsPage /> }];
