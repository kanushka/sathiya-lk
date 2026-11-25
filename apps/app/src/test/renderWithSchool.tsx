// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Claims, Entry, Lang, SchoolContext, Year } from '@sathiya/core';
import { createI18n } from '@sathiya/i18n';
import { render, type RenderOptions } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContextProvider, type AuthState } from '../app/AuthProvider';
import { LangContextProvider } from '../app/LangProvider';
import { SchoolContextProvider, type SchoolState, type YearState } from '../app/SchoolProvider';
import { ToastProvider } from '../ui/Toast';
import { testI18n } from './render';

export interface RenderWithSchoolOptions {
  ctx: SchoolContext;
  loading?: boolean;
  entries?: Entry[];
  years?: Year[];
  yearId?: string;
  claims?: Claims;
  route?: string;
  path?: string;
  lang?: Lang;
  user?: Partial<User>;
  signOut?: () => Promise<void>;
  renderOptions?: Omit<RenderOptions, 'wrapper'>;
}

export const testYear: Year = { id: 'y-2026', label: '2026', status: 'draft' };

function Providers({ options, children }: { options: RenderWithSchoolOptions; children: ReactNode }) {
  const [fixed] = useState(() => ({
    ctx: options.ctx,
    loading: options.loading ?? false,
    entries: options.entries ?? [],
    years: options.years ?? [testYear],
    claims: options.claims ?? { schools: { [options.ctx.school.id]: { r: 'a' as const } } },
    lang: options.lang ?? 'en',
    user: { uid: 'test-user', ...options.user } as User,
    signOut: options.signOut ?? (async () => undefined),
  }));
  const { ctx, loading, entries, years, claims, lang, user, signOut } = fixed;
  const [yearId, setYearId] = useState(options.yearId ?? years[0]?.id ?? '');
  const [i18n] = useState(() => (lang === 'en' ? testI18n : createI18n(lang)));

  const auth = useMemo<AuthState>(
    () => ({ user, claims, loading: false, refreshClaims: async () => claims, signOut }),
    [user, claims, signOut],
  );
  const school = useMemo<SchoolState>(() => ({ ...ctx, loading }), [ctx, loading]);
  const year = useMemo<YearState>(() => ({ years, yearId, setYearId, entries, loading: false }), [years, yearId, entries]);
  const langState = useMemo(() => ({ lang, setLang: () => undefined }), [lang]);

  return (
    <AuthContextProvider value={auth}>
      <LangContextProvider value={langState}>
        <I18nextProvider i18n={i18n}>
          <ToastProvider>
            <SchoolContextProvider school={school} year={year}>
              {children}
            </SchoolContextProvider>
          </ToastProvider>
        </I18nextProvider>
      </LangContextProvider>
    </AuthContextProvider>
  );
}

export function renderWithSchool(ui: ReactElement, options: RenderWithSchoolOptions) {
  const route = options.route ?? '/';
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Providers options={options}>
        {options.path ? (
          <Routes>
            <Route path={options.path} element={ui} />
          </Routes>
        ) : (
          ui
        )}
      </Providers>
    </MemoryRouter>,
    options.renderOptions,
  );
}
