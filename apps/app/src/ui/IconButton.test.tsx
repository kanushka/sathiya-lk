// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('exposes its label as accessible name and title', () => {
    render(<IconButton icon="close" label="Close" />);
    const b = screen.getByRole('button', { name: 'Close' });
    expect(b).toHaveAttribute('title', 'Close');
    expect(b).not.toHaveAttribute('aria-pressed');
  });

  it('sets aria-pressed when pressed is defined', () => {
    const { rerender } = render(<IconButton icon="pin" label="Pin" pressed />);
    expect(screen.getByRole('button', { name: 'Pin' })).toHaveAttribute('aria-pressed', 'true');
    rerender(<IconButton icon="pin" label="Pin" pressed={false} />);
    expect(screen.getByRole('button', { name: 'Pin' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('uses square sizing per size', () => {
    const { rerender } = render(<IconButton icon="close" label="x" size="sm" />);
    expect(screen.getByRole('button')).toHaveClass('w-8', 'h-8');
    rerender(<IconButton icon="close" label="x" />);
    expect(screen.getByRole('button')).toHaveClass('w-10', 'h-10');
  });

  it('has no horizontal padding class', () => {
    render(<IconButton icon="close" label="x" />);
    expect(screen.getByRole('button').className).not.toMatch(/(^|\s)px-/);
  });
});
