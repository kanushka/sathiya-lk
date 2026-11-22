// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { act, screen } from '@testing-library/react';
import { renderWithI18n as render } from '../test/render';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, buttonClass } from './Button';

afterEach(() => vi.useRealTimers());

describe('Button loading', () => {
  it('shows a spinner, the action label, aria-busy and is disabled', () => {
    render(<Button loading loadingLabel="Saving…">Save</Button>);
    const b = screen.getByRole('button');
    expect(b).toHaveAttribute('aria-busy', 'true');
    expect(b).toBeDisabled();
    expect(b).toHaveTextContent('Saving…');
    expect(b.querySelector('[data-spinner]')).not.toBeNull();
    expect(b.querySelector('[data-spinner]')).toHaveClass('motion-safe:animate-spin');
  });

  it('keeps the idle label in the layout so the width does not jump', () => {
    render(<Button loading>Save</Button>);
    const hidden = screen.getByRole('button').querySelector('[aria-hidden="true"].invisible');
    expect(hidden).toHaveTextContent('Save');
  });

  it('is a normal button when not loading', () => {
    render(<Button>Save</Button>);
    const b = screen.getByRole('button', { name: 'Save' });
    expect(b).not.toHaveAttribute('aria-busy');
    expect(b.querySelector('[data-spinner]')).toBeNull();
  });

  it('hints "Still working…" after about five seconds', () => {
    vi.useFakeTimers();
    render(<Button loading loadingLabel="Saving…">Save</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Saving…');
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole('button')).toHaveTextContent('Still working…');
  });
});

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

  it('buttonClass gives the same classes a Button uses', () => {
    render(<Button variant="ghost" size="sm">x</Button>);
    const cls = buttonClass({ variant: 'ghost', size: 'sm' });
    expect(screen.getByRole('button').className).toBe(cls);
    expect(cls).toContain('h-8');
    expect(buttonClass({ size: 'sm', square: true })).toContain('w-8');
  });
});
