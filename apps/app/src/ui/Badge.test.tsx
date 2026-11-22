// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('defaults to neutral', () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText('Draft')).toHaveClass('bg-surface-3', 'text-ink-soft', 'h-[22px]');
  });

  it.each([
    ['brand', 'bg-brand/10'],
    ['success', 'bg-success-soft'],
    ['warning', 'bg-warning-soft'],
    ['danger', 'bg-danger-soft'],
  ] as const)('applies %s tone', (tone, cls) => {
    render(<Badge tone={tone}>x</Badge>);
    expect(screen.getByText('x')).toHaveClass(cls);
  });

  it('renders a hidden dot without changing the accessible text', () => {
    render(<Badge dot>Live</Badge>);
    expect(screen.getByText('Live')).toHaveTextContent(/^Live$/);
    expect(screen.getByText('Live').querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
