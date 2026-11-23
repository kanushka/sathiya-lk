// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { createI18n } from '@sathiya/i18n';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { pageTitle, useDocumentTitle } from './brand';

describe('page titles', () => {
  it('end with the site name', () => {
    expect(pageTitle('Sathiya (සතිය)')).toBe('Sathiya (සතිය)');
    expect(pageTitle('Sathiya (සතිය)', 'Sign in')).toBe('Sign in · Sathiya (සතිය)');
  });

  it('sets and restores document.title from the brand string', () => {
    const i18n = createI18n('si');
    const wrapper = ({ children }: { children: ReactNode }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
    const { unmount } = renderHook(() => useDocumentTitle('පිවිසෙන්න'), { wrapper });
    expect(document.title).toBe('පිවිසෙන්න · Sathiya (සතිය)');
    unmount();
    expect(document.title).toBe('Sathiya (සතිය)');
  });
});
