// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { C, ctx, entries, entry, S, T } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { call } from '../../lib/callable';
import { renderWithSchool } from '../../test/renderWithSchool';
import * as api from './api';
import { DashboardPage } from './DashboardPage';

const flags = vi.hoisted(() => ({ readOnly: false }));

vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));
vi.mock('../../ui/AdminLayout', async (orig) => ({ ...(await orig<typeof import('../../ui/AdminLayout')>()), useReadOnly: () => flags.readOnly }));
vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), createYear: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  flags.readOnly = false;
});

function setup() {
  renderWithSchool(<DashboardPage />, { ctx, entries });
  return userEvent.setup();
}

describe('dashboard page', () => {
  it('shows stats from the fixtures', () => {
    setup();
    const stat = (label: string) => screen.getByText(label).closest('div')!;
    expect(within(stat('Classes complete')).getByText('0 / 5')).toBeInTheDocument();
    expect(within(stat('Empty slots')).getByText('145')).toBeInTheDocument();
    expect(within(stat('Clashes')).getByText('0')).toBeInTheDocument();
    expect(within(stat('Over daily limit')).getByText('0')).toBeInTheDocument();
  });

  it('links class chips to the class timetable', () => {
    setup();
    expect(screen.getByRole('link', { name: /^6B/ })).toHaveAttribute('href', '/admin/timetable/class?c=c-6b');
  });

  it('renders translated attention items with links', () => {
    const over = Array.from({ length: 8 }, (_, i) => entry(`o${i}`, 0, i + 1, [C.c6a], [[S.sinhala, T.kumara]]));
    renderWithSchool(<DashboardPage />, { ctx, entries: [...entries, ...over] });
    const limit = screen.getByRole('link', { name: /Mr\. S\. Kumara — 8 periods on Monday/ });
    expect(limit).toHaveAttribute('href', '/admin/timetable/teacher?t=t-kumara');
    expect(within(limit).getByText('Daily limit is 7')).toBeInTheDocument();
    const target = screen.getByRole('link', { name: /6A Sinhala 8 \/ 5/ });
    expect(target).toHaveAttribute('href', '/admin/timetable/class?c=c-6a');
    expect(within(target).getByText('3 too many periods')).toBeInTheDocument();
    expect(screen.queryByText(/periods on Mon\b/)).not.toBeInTheDocument();
  });

  it('publishes through the callable after confirming', async () => {
    vi.mocked(call).mockResolvedValue({ classes: 5, teachers: 19 });
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Publish to teachers' }));
    expect(call).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' }));
    expect(call).toHaveBeenCalledWith('publishYear', { schoolId: 'siripura', yearId: 'y-2026' });
    expect(await screen.findByText(/5 classes.*19 teachers/)).toBeInTheDocument();
  });

  it('keeps the modal usable when publish fails', async () => {
    vi.mocked(call).mockRejectedValue(new Error('boom'));
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Publish to teachers' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Could not publish. Try again.')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' })).toBeEnabled();
  });

  it('creates a draft year from the label', async () => {
    vi.mocked(api.createYear).mockResolvedValue('y-2027');
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'New year' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Create year' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Year label'), ' 2027 ');
    await user.click(within(dialog).getByRole('button', { name: 'Create year' }));
    expect(api.createYear).toHaveBeenCalledWith('siripura', '2027');
  });

  it('hides write actions when read-only', () => {
    flags.readOnly = true;
    setup();
    expect(screen.queryByRole('button', { name: 'New year' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish to teachers' })).not.toBeInTheDocument();
    expect(screen.getByText('Classes complete')).toBeInTheDocument();
  });
});
