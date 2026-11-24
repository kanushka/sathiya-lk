// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { buildSnapshots } from '@sathiya/core';
import { mahasen } from '@sathiya/core/fixtures';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n } from '../../test/render';
import { PrintSheet } from './PrintSheet';

describe('PrintSheet activity rows', () => {
  it('prints activity names instead of the interval label', () => {
    const { classes } = buildSnapshots(mahasen.ctx, [], { id: 'y', label: '2026', status: 'draft' });
    renderWithI18n(<PrintSheet kind="class" snapshot={classes[0]!} lang="en" />);
    expect(screen.getByText('Assembly · 07:30 – 07:45')).toBeInTheDocument();
    expect(screen.getByText('School meal · 07:55 – 08:15')).toBeInTheDocument();
    expect(screen.getByText(/^Interval · 10:10 – 10:20$/)).toBeInTheDocument();
  });

  it('prints each weekday its own activity when they differ', () => {
    const { classes } = buildSnapshots(mahasen.ctx, [], { id: 'y', label: '2026', status: 'draft' });
    const snap = classes[0]!;
    const act = (nameEn: string) => ({ type: 'activity' as const, start: '07:00', end: '07:10', nameEn });
    const per = { type: 'period' as const, start: '07:10', end: '07:50' };
    const rows = { 0: [act('Assembly'), per], 1: [act('Choir'), per], 2: [act('Assembly'), per], 3: [act('Assembly'), per], 4: [act('Assembly'), per] };
    renderWithI18n(<PrintSheet kind="class" snapshot={{ ...snap, rows, cells: [] }} lang="en" />);
    expect(screen.getByText('Choir · 07:00 – 07:10')).toBeInTheDocument();
    expect(screen.getAllByText('Assembly · 07:00 – 07:10')).toHaveLength(4);
  });
});
