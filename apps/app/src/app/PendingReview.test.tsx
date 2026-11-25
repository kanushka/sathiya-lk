// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { School } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/callable';
import { renderWithSchool } from '../test/renderWithSchool';
import { isSchoolPendingError, LockedButton, PendingBanner } from './PendingReview';

const withStatus = (status: School['status']) => ({ ...ctx, school: { ...ctx.school, status } });

describe('PendingBanner', () => {
  it('shows while the school is pending review', () => {
    renderWithSchool(<PendingBanner />, { ctx: withStatus('pending') });
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Under review');
    expect(banner).toHaveTextContent('Your school is under review. Some features are not available until Sathiya approves it.');
  });

  it.each(['active', 'disabled'] as const)('is hidden for a %s school', (status) => {
    renderWithSchool(<PendingBanner />, { ctx: withStatus(status) });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows in Sinhala', () => {
    renderWithSchool(<PendingBanner />, { ctx: withStatus('pending'), lang: 'si' });
    expect(screen.getByRole('status')).toHaveTextContent('ඔබේ පාසල සමාලෝචනය කෙරෙමින් පවතී.');
  });
});

describe('LockedButton', () => {
  it('is disabled and described by the approval note', () => {
    renderWithSchool(<LockedButton>Auto-fill</LockedButton>, { ctx });
    const button = screen.getByRole('button', { name: 'Auto-fill' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Available after Sathiya approves your school.');
  });
});

describe('isSchoolPendingError', () => {
  it('matches only the school-pending code', () => {
    expect(isSchoolPendingError(new ApiError('school-pending', 'x'))).toBe(true);
    expect(isSchoolPendingError({ code: 'functions/failed-precondition', details: { code: 'school-pending' } })).toBe(true);
    expect(isSchoolPendingError(new ApiError('school-disabled', 'x'))).toBe(false);
  });
});
