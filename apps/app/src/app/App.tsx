// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { RouterProvider } from 'react-router-dom';
import { ToastProvider } from '../ui/Toast';
import { AuthProvider } from './AuthProvider';
import { LangProvider } from './LangProvider';
import { router } from './router';

export function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </LangProvider>
    </AuthProvider>
  );
}
