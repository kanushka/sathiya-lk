// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormError } from './FormError';

describe('FormError', () => {
  it('renders an alert with the message', () => {
    render(<FormError>Bad</FormError>);
    expect(screen.getByRole('alert')).toHaveTextContent('Bad');
  });

  it('uses text-sm by default and text-xs for field size', () => {
    const { rerender } = render(<FormError>Bad</FormError>);
    expect(screen.getByRole('alert')).toHaveClass('text-sm');
    rerender(<FormError size="field">Bad</FormError>);
    expect(screen.getByRole('alert')).toHaveClass('text-xs');
    expect(screen.getByRole('alert')).not.toHaveClass('text-sm');
  });

  it('renders nothing when empty', () => {
    const { container, rerender } = render(<FormError>{null}</FormError>);
    expect(container).toBeEmptyDOMElement();
    rerender(<FormError>{''}</FormError>);
    expect(container).toBeEmptyDOMElement();
  });
});
