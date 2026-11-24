// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { SchoolContext } from '@sathiya/core';
import { C, ctx, entries6B, entry, mahasen, S, shortFridayTemplate, T, TPL } from '@sathiya/core/fixtures';
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

  it('totals against the plan, not the template capacity, so it matches the dashboard', () => {
    const rows = shortFridayTemplate.rows;
    const shrunk: SchoolContext = {
      ...ctx,
      templates: ctx.templates.map((t) => (t.id === TPL.shortFriday ? { ...shortFridayTemplate, days: { 0: rows, 1: rows, 2: rows, 3: rows, 4: rows.slice(0, -3) } } : t)),
    };
    const cls6C = shrunk.classes.find((c) => c.id === C.c6c)!;
    renderWithSchool(<SubjectProgress cls={cls6C} entries={[]} />, { ctx: shrunk });
    expect(screen.getByText('/ 40 placed')).toBeInTheDocument();
  });

  it('shows minute rows as placed/needed minutes', () => {
    const mh = mahasen.ctx;
    const cls = mh.classes[0]!;
    const es = [entry('m1', 0, 1, [cls.id], [[mahasen.S.maths, 'mh-t-1a']]), entry('m2', 1, 3, [cls.id], [[mahasen.S.maths, 'mh-t-1a']])];
    renderWithSchool(<SubjectProgress cls={cls} entries={es} />, { ctx: mh, entries: es });
    expect(row('Mathematics')).toHaveTextContent('1h 30m/3h 10m');
    expect(row('English')).toHaveTextContent('0/50 min');
  });

  it('totals an all-minutes class in minutes', () => {
    const mh = mahasen.ctx;
    const cls = mh.classes[0]!;
    const es = [entry('m1', 0, 1, [cls.id], [[mahasen.S.maths, 'mh-t-1a']])];
    renderWithSchool(<SubjectProgress cls={cls} entries={es} />, { ctx: mh, entries: es });
    expect(screen.getByText('1h 50m')).toBeInTheDocument();
    expect(screen.getByText('/ 17h 30m placed')).toBeInTheDocument();
  });
});
