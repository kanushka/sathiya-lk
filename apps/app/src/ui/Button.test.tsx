// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('defaults to secondary md button type', () => {
    render(<Button>Go</Button>);
    const b = screen.getByRole('button', { name: 'Go' });
    expect(b).toHaveAttribute('type', 'button');
    expect(b).toHaveClass('border-line-strong', 'h-10');
  });

  it.each([
    ['primary', 'bg-brand'],
    ['danger', 'border-danger-line'],
    ['dangerSolid', 'bg-danger'],
    ['onBrand', 'text-on-brand'],
    ['ghost', 'bg-transparent'],
  ] as const)('applies %s variant', (variant, cls) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole('button')).toHaveClass(cls);
  });

  it('link variant ignores size', () => {
    render(
      <Button variant="link" size="lg">
        more
      </Button>,
    );
    const b = screen.getByRole('button');
    expect(b).toHaveClass('text-brand', 'font-semibold', 'p-0');
    expect(b).not.toHaveClass('h-11');
    expect(b).not.toHaveClass('h-10');
  });

  it('is not clickable when disabled', () => {
    render(<Button disabled>x</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
