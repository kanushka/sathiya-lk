import type { RouteObject } from 'react-router-dom';
import { LoginPage } from './LoginPage';

export const routes: RouteObject[] = [{ path: '/login', element: <LoginPage /> }];
