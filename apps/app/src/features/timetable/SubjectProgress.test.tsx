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

  it('offers a pin button per subject and group row, keyed by plan key', async () => {
    const onPin = vi.fn();
    renderWithSchool(<SubjectProgress cls={cls6B} entries={entries6B} onPin={onPin} onStop={vi.fn()} />, { ctx, entries: entries6B });
    await userEvent.click(within(row('Sinhala')).getByRole('button', { name: 'Pin Sinhala' }));
    expect(onPin).toHaveBeenCalledWith(expect.objectContaining({ kind: 'subject', subjectId: S.sinhala }));
    const religion = within(row('Religion')).getByRole('button', { name: 'Pin Religion' });
    expect(religion).toHaveAttribute('data-pin-key', 'group:religion');
    expect(within(row('Sinhala')).getByRole('button')).toHaveAttribute('data-pin-key', `subject:${S.sinhala}`);
    await userEvent.click(religion);
    expect(onPin).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'group', key: 'religion' }));
  });

  it('marks a group row active by its plan key', () => {
    renderWithSchool(<SubjectProgress cls={cls6B} entries={entries6B} onPin={vi.fn()} onStop={vi.fn()} activeKey="group:religion" />, { ctx, entries: entries6B });
    expect(row('Religion')).toHaveAttribute('data-active', 'true');
    expect(within(row('Religion')).getByRole('button', { name: 'Done pinning Religion' })).toBeInTheDocument();
  });

  it('tints the row being pinned and swaps its button to Done pinning', async () => {
    const onStop = vi.fn();
    renderWithSchool(<SubjectProgress cls={cls6B} entries={entries6B} onPin={vi.fn()} onStop={onStop} activeKey={`subject:${S.sinhala}`} />, { ctx, entries: entries6B });
    expect(row('Sinhala')).toHaveAttribute('data-active', 'true');
    expect(row('Science')).not.toHaveAttribute('data-active');
    await userEvent.click(within(row('Sinhala')).getByRole('button', { name: 'Done pinning Sinhala' }));
    expect(onStop).toHaveBeenCalled();
  });

  it('flags a subject placed over its weekly plan', () => {
    const extra = [...entries6B, entry('x', 2, 4, [C.c6b], [[S.sinhala, T.rSilva]])];
    renderWithSchool(<SubjectProgress cls={cls6B} entries={extra} />, { ctx, entries: extra });
    expect(row('Sinhala')).toHaveTextContent('6/5');
    expect(within(row('Sinhala')).getByText('6/5')).toHaveAttribute('data-over', 'true');
    expect(screen.getByText('36')).toBeInTheDocument();
  });

  it('leaves entries outside the class template out of every count', () => {
    const cls6C = ctx.classes.find((c) => c.id === C.c6c)!;
    const list = [entry('in', 0, 1, [C.c6c], [[S.science, T.gunasekara]]), entry('out', 4, 8, [C.c6c], [[S.science, T.gunasekara]])];
    renderWithSchool(<SubjectProgress cls={cls6C} entries={list} />, { ctx, entries: list });
    expect(row('Science')).toHaveTextContent('1/5');
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
