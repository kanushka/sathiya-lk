// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx, entries } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { call } from '../../lib/callable';
import { renderWithSchool } from '../../test/renderWithSchool';
import * as api from './api';
import { SubjectsPage } from './SubjectsPage';

vi.mock('./api');
vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));

const flags = vi.hoisted(() => ({ readOnly: false }));
vi.mock('../../ui/AdminLayout', async (orig) => ({ ...(await orig<typeof import('../../ui/AdminLayout')>()), useReadOnly: () => flags.readOnly }));

beforeEach(() => {
  vi.resetAllMocks();
  flags.readOnly = false;
});

const render = () => renderWithSchool(<SubjectsPage />, { ctx, entries });

describe('subjects page', () => {
  it('header actions end with the primary + Add subject', () => {
    render();
    expect(within(screen.getByTestId('page-header')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Load standard Sri Lankan list', '+ Add subject']);
  });

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
      short: 'Agri',
      color: '#E2EEE0',
    });
  });

  it('save shows the loading state while pending, then closes', async () => {
    let resolve!: () => void;
    vi.mocked(api.addSubject).mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: '+ Add subject' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name in English'), 'Agriculture');
    await user.click(within(dialog).getByRole('button', { name: 'Add subject' }));
    const saving = await within(dialog).findByRole('button', { name: 'Saving…' });
    expect(saving).toHaveAttribute('aria-busy', 'true');
    expect(saving).toBeDisabled();
    resolve();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('suggests a unique short name from the English name until the user edits it', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: '+ Add subject' }));
    const dialog = screen.getByRole('dialog');
    const short = within(dialog).getByLabelText('Short name');
    await user.type(within(dialog).getByLabelText('Name in English'), 'Information & Communication Technology');
    expect(short).toHaveValue('ICT');
    await user.clear(within(dialog).getByLabelText('Name in English'));
    await user.type(within(dialog).getByLabelText('Name in English'), 'English Literature');
    expect(short).toHaveValue('ELit');
    await user.clear(short);
    await user.type(short, 'EngLit');
    await user.type(within(dialog).getByLabelText('Name in English'), ' A');
    expect(short).toHaveValue('EngLit');
  });

  it('makes the suggestion unique and flags a short name that already exists', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: '+ Add subject' }));
    const dialog = screen.getByRole('dialog');
    const short = within(dialog).getByLabelText('Short name');
    await user.type(within(dialog).getByLabelText('Name in English'), 'Bud');
    expect(short).toHaveValue('Bud2');
    await user.clear(short);
    await user.type(short, 'maths');
    expect(within(dialog).getByText('Another subject already uses this short name')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add subject' }));
    expect(api.addSubject).not.toHaveBeenCalled();
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

  it('read-only hides write controls and makes inline inputs readOnly', () => {
    flags.readOnly = true;
    render();
    for (const name of ['+ Add subject', 'Load standard Sri Lankan list', 'Delete']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByLabelText('English name of Mathematics')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Short name of Mathematics')).toHaveAttribute('readonly');
  });
});
