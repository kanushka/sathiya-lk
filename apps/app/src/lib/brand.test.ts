// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pageTitle, useDocumentTitle } from './brand';

describe('page titles', () => {
  it('end with the site name', () => {
    expect(pageTitle()).toBe('Sathiya (සතිය)');
    expect(pageTitle('Sign in')).toBe('Sign in · Sathiya (සතිය)');
  });

  it('sets and restores document.title', () => {
    const { unmount } = renderHook(() => useDocumentTitle('පිවිසෙන්න'));
    expect(document.title).toBe('පිවිසෙන්න · Sathiya (සතිය)');
    unmount();
    expect(document.title).toBe('Sathiya (සතිය)');
  });
});
