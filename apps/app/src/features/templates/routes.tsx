
import type { RouteObject } from 'react-router-dom';
import { TemplatesPage } from './TemplatesPage';

export const routes: RouteObject[] = [{ path: '/admin/templates', element: <TemplatesPage /> }];
