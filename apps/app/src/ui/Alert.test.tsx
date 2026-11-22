// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from './Alert';

describe('Alert', () => {
  it('uses alert role for danger', () => {
    render(<Alert tone="danger">Oops</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Oops');
  });

  it.each(['warning', 'success', 'info'] as const)('uses status role for %s', (tone) => {
    render(<Alert tone={tone}>Note</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Note');
  });

  it('allows a role override', () => {
    render(
      <Alert tone="warning" role="alert">
        Careful
      </Alert>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
