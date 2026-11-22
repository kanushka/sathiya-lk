// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('puts the title on the left and the actions, primary last, on the right', () => {
    render(
      <PageHeader title="Subjects" count={3} subtitle="One list" actions={<><Button>Load</Button><Button variant="primary">+ Add</Button></>} />,
    );
    const header = screen.getByTestId('page-header');
    expect(within(header).getByRole('heading', { level: 1, name: 'Subjects' })).toBeInTheDocument();
    expect(within(header).getByText('3')).toBeInTheDocument();
    expect(within(header).getByText('One list')).toBeInTheDocument();
    const buttons = within(header).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Load', '+ Add']);
  });
  it('renders without actions', () => {
    render(<PageHeader title="Profile" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    expect(within(screen.getByTestId('page-header')).queryByRole('button')).toBeNull();
  });
});
