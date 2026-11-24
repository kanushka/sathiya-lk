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
});
