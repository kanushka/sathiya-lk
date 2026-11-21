// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Claims } from '@sathiya/core';
import { render } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { useMemo, useState, type ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContextProvider, type AuthState } from '../../app/AuthProvider';
import { LangContextProvider } from '../../app/LangProvider';
import { HomeRedirect } from '../../app/router';
import { testI18n } from '../../test/render';
import { ToastProvider } from '../../ui/Toast';

export interface AuthHarnessOptions {
  route?: string;
  at?: '/login' | '/register';
  signedIn?: boolean;
  passwordUser?: boolean;
  emailVerified?: boolean;
  claims?: Claims;
  claimsAfterRefresh?: Claims;
  refreshClaims?: () => Promise<void>;
}

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname}</p>;
}

function Harness({ options, children }: { options: AuthHarnessOptions; children: ReactElement }) {
  const [claims, setClaims] = useState<Claims>(options.claims ?? {});
  const auth = useMemo<AuthState>(
    () => ({
      user: options.signedIn
        ? ({
            uid: 'u1',
            email: 'a@b.lk',
            emailVerified: options.emailVerified ?? false,
            providerData: options.passwordUser ? [{ providerId: 'password' }] : [{ providerId: 'google.com' }],
          } as unknown as User)
        : null,
      claims,
      loading: false,
      refreshClaims: async () => {
        await options.refreshClaims?.();
        if (options.claimsAfterRefresh) setClaims(options.claimsAfterRefresh);
      },
      signOut: async () => undefined,
    }),
    [claims, options],
  );
  const lang = useMemo(() => ({ lang: 'en' as const, setLang: () => undefined }), []);
  return (
    <AuthContextProvider value={auth}>
      <LangContextProvider value={lang}>
        <I18nextProvider i18n={testI18n}>
          <ToastProvider>
            <Routes>
              <Route path={options.at ?? '/login'} element={children} />
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/admin" element={<Where />} />
              <Route path="/me" element={<Where />} />
              <Route path="/super" element={<Where />} />
              <Route path="*" element={<Where />} />
            </Routes>
          </ToastProvider>
        </I18nextProvider>
      </LangContextProvider>
    </AuthContextProvider>
  );
}

export function renderAuth(ui: ReactElement, options: AuthHarnessOptions = {}) {
  return render(
    <MemoryRouter initialEntries={[options.route ?? '/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Harness options={options}>{ui}</Harness>
    </MemoryRouter>,
  );
}
