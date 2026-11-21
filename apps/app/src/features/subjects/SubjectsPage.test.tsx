// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx, entries } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { call } from '../../lib/callable';
import { renderWithSchool } from '../../test/renderWithSchool';
import * as api from './api';
import { SubjectsPage } from './SubjectsPage';

vi.mock('./api');
vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

const render = () => renderWithSchool(<SubjectsPage />, { ctx, entries });

describe('subjects page', () => {
  it('add requires the English name', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: '+ Add subject' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add subject' }));
    expect(within(dialog).getByText('Enter the subject name in English')).toBeInTheDocument();
    expect(api.addSubject).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText('Name in English'), 'Agriculture');
    await user.click(within(dialog).getByRole('button', { name: 'Add subject' }));
    expect(api.addSubject).toHaveBeenCalledWith('siripura', {
      nameEn: 'Agriculture',
      nameSi: '',
      short: 'Agricultur',
      color: '#E2EEE0',
    });
  });

  it('load standard skips subjects already present and reports the count', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchDefaultSubjects).mockResolvedValue([
      { nameEn: ' mathematics ', short: 'Maths', color: '#D4ECEA' },
      { nameEn: 'Agriculture', short: 'Agri', color: '#E2EEE0' },
      { nameEn: 'Drama', short: 'Drama', color: '#EBDDF2' },
    ]);
    render();
    await user.click(screen.getByRole('button', { name: 'Load standard Sri Lankan list' }));
    expect(await screen.findByText('2 subjects added')).toBeInTheDocument();
    expect(api.addSubjects).toHaveBeenCalledWith('siripura', [
      { nameEn: 'Agriculture', short: 'Agri', color: '#E2EEE0' },
      { nameEn: 'Drama', short: 'Drama', color: '#EBDDF2' },
    ]);
  });

  it('refuses to delete a subject that is in use and shows the count', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockResolvedValue({ deleted: false, usedIn: 12 });
    render();
    const row = screen.getByLabelText('English name of Mathematics').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Used in 12 slots');
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('inline edit saves a changed short name and ignores an emptied English name', async () => {
    const user = userEvent.setup();
    render();
    const short = screen.getByLabelText('Short name of Mathematics');
    await user.clear(short);
    await user.type(short, 'Math{Enter}');
    expect(api.updateSubject).toHaveBeenCalledWith('siripura', 's-maths', expect.objectContaining({ nameEn: 'Mathematics', short: 'Math' }));

    vi.mocked(api.updateSubject).mockClear();
    const en = screen.getByLabelText('English name of Mathematics');
    await user.clear(en);
    await user.tab();
    expect(api.updateSubject).not.toHaveBeenCalled();
    expect(en).toHaveValue('Mathematics');
  });
});
