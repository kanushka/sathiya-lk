// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { C, ctx, entries6B, entry, S, T } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { SubjectProgress } from './SubjectProgress';

const cls6B = ctx.classes.find((c) => c.id === C.c6b)!;
const row = (name: string) => screen.getByText(name).closest('li')!;

describe('SubjectProgress', () => {
  it('shows placed/needed per plan item and the week total', () => {
    renderWithSchool(<SubjectProgress cls={cls6B} entries={entries6B} />, { ctx, entries: entries6B });
    expect(screen.getByRole('heading', { name: '6B subjects' })).toBeInTheDocument();
    expect(row('Mathematics')).toHaveTextContent('6/6');
    expect(row('Science')).toHaveTextContent('3/5');
    expect(row('Religion')).toHaveTextContent('3/3');
    expect(screen.getByText('36')).toBeInTheDocument();
    expect(screen.getByText('/ 40 placed')).toBeInTheDocument();
  });

  it('renders a bar per item filled to the placed share', () => {
    renderWithSchool(<SubjectProgress cls={cls6B} entries={entries6B} />, { ctx, entries: entries6B });
    expect(row('Science').querySelector('[data-bar]')).toHaveStyle({ width: '60%' });
    expect(row('Mathematics').querySelector('[data-bar]')).toHaveStyle({ width: '100%' });
  });

  it('has no pin buttons without a pin handler', () => {
    renderWithSchool(<SubjectProgress cls={cls6B} entries={entries6B} />, { ctx, entries: entries6B });
    expect(screen.queryByRole('button', { name: /^Pin / })).not.toBeInTheDocument();
  });

  it('offers a pin button per subject row, none for groups', async () => {
    const onPin = vi.fn();
    renderWithSchool(<SubjectProgress cls={cls6B} entries={entries6B} onPin={onPin} onStop={vi.fn()} />, { ctx, entries: entries6B });
    expect(within(row('Religion')).queryByRole('button')).not.toBeInTheDocument();
    await userEvent.click(within(row('Sinhala')).getByRole('button', { name: 'Pin Sinhala' }));
    expect(onPin).toHaveBeenCalledWith(S.sinhala);
  });

  it('tints the row being pinned and turns its button into stop', async () => {
    const onStop = vi.fn();
    renderWithSchool(<SubjectProgress cls={cls6B} entries={entries6B} onPin={vi.fn()} onStop={onStop} activeSubjectId={S.sinhala} />, { ctx, entries: entries6B });
    expect(row('Sinhala')).toHaveAttribute('data-active', 'true');
    expect(row('Science')).not.toHaveAttribute('data-active');
    await userEvent.click(within(row('Sinhala')).getByRole('button', { name: 'Stop pinning Sinhala' }));
    expect(onStop).toHaveBeenCalled();
  });

  it('flags a subject placed over its weekly plan', () => {
    const extra = [...entries6B, entry('x', 2, 4, [C.c6b], [[S.sinhala, T.rSilva]])];
    renderWithSchool(<SubjectProgress cls={cls6B} entries={extra} />, { ctx, entries: extra });
    expect(row('Sinhala')).toHaveTextContent('6/5');
    expect(within(row('Sinhala')).getByText('6/5')).toHaveAttribute('data-over', 'true');
  });
});
