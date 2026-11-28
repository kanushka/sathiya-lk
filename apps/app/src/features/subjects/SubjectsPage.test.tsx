// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx, entries } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { call } from '../../lib/callable';
import { installMatchMedia } from '../../test/matchMedia';
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
    expect(within(screen.getByTestId('page-header')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Load standard Sri Lankan list', 'Import', '+ Add subject']);
  });

  it('add requires an English or a Sinhala name', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: '+ Add subject' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add subject' }));
    expect(within(dialog).getByText('Enter the name in English or Sinhala (or both).')).toBeInTheDocument();
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

  it('rejects an English or Sinhala name that another subject already has', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: '+ Add subject' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name in English'), '  mathematics ');
    expect(within(dialog).getByText('mathematics already exists')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add subject' }));
    expect(api.addSubject).not.toHaveBeenCalled();
    await user.clear(within(dialog).getByLabelText('Name in English'));
    await user.type(within(dialog).getByLabelText('Name in English'), 'Agriculture');
    await user.type(within(dialog).getByLabelText('Name in Sinhala'), 'ගණිතය');
    expect(within(dialog).getByText('ගණිතය already exists')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add subject' }));
    expect(api.addSubject).not.toHaveBeenCalled();
  });

  it('inline edit refuses a name that another subject already has', async () => {
    const user = userEvent.setup();
    render();
    const en = screen.getByLabelText('English name of Sinhala');
    await user.clear(en);
    await user.type(en, 'mathematics{Enter}');
    expect(await screen.findByText('mathematics already exists')).toBeInTheDocument();
    expect(api.updateSubject).not.toHaveBeenCalled();
    expect(en).toHaveValue('Sinhala');
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

  it('inline edit saves a changed short name and refuses to empty the only name', async () => {
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
    expect(api.updateSubject).toHaveBeenCalledWith('siripura', 's-maths', expect.objectContaining({ nameEn: '', nameSi: 'ගණිතය' }));
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

describe('subject name order by school medium', () => {
  it('asks for the Sinhala name first when the school teaches in Sinhala', async () => {
    const user = userEvent.setup();
    renderWithSchool(<SubjectsPage />, { ctx: { ...ctx, school: { ...ctx.school, medium: ['si'] } }, entries });
    await user.click(screen.getByRole('button', { name: '+ Add subject' }));
    const langs = within(screen.getByRole('dialog')).getAllByRole('textbox').filter((el) => el.getAttribute('lang')).map((el) => el.getAttribute('lang'));
    expect(langs).toEqual(['si', 'en']);
  });

  it('keeps English first for a legacy school with no medium', async () => {
    const user = userEvent.setup();
    const { medium: _, ...school } = ctx.school;
    renderWithSchool(<SubjectsPage />, { ctx: { ...ctx, school }, entries });
    await user.click(screen.getByRole('button', { name: '+ Add subject' }));
    const langs = within(screen.getByRole('dialog')).getAllByRole('textbox').filter((el) => el.getAttribute('lang')).map((el) => el.getAttribute('lang'));
    expect(langs).toEqual(['en', 'si']);
  });
});

describe('subjects page on a phone', () => {
  let restore: () => void = () => undefined;
  beforeEach(() => {
    restore = installMatchMedia(390);
  });
  afterEach(() => restore());

  it('lists unused subjects first with Delete, then subjects in the timetable with their slot count', () => {
    render();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const unused = screen.getByRole('region', { name: /Not used yet/ });
    const used = screen.getByRole('region', { name: /In the timetable/ });
    expect(unused.compareDocumentPosition(used) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(unused).getByRole('button', { name: 'Delete Pali' })).toBeInTheDocument();
    expect(within(used).queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
    expect(within(used).getAllByText(/\d+ slots?$/).length).toBeGreaterThan(0);
  });

  it('keeps Load standard list and Import as buttons below the title row', () => {
    render();
    expect(within(screen.getByTestId('page-header')).getAllByRole('button').map((b) => b.textContent)).toEqual(['+ Add subject']);
    expect(screen.getByRole('button', { name: 'Load standard Sri Lankan list' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
  });

  it('tapping a subject opens an edit dialog that saves the change', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'Edit Art' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit subject' });
    const en = within(dialog).getByLabelText('Name in English');
    expect(en).toHaveValue('Art');
    await user.clear(en);
    await user.type(en, 'Art & Craft');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updateSubject).toHaveBeenCalledWith(ctx.school.id, 's-art', expect.objectContaining({ nameEn: 'Art & Craft' })));
    expect(api.addSubject).not.toHaveBeenCalled();
  });
});

describe('empty subjects', () => {
  it('keeps the standard list button and shows one add button', () => {
    renderWithSchool(<SubjectsPage />, { ctx: { ...ctx, subjects: [] }, entries: [] });
    expect(screen.getAllByRole('button', { name: '+ Add subject' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Load standard Sri Lankan list' })).toHaveLength(1);
    expect(screen.queryByText(/Short name is what fits/)).not.toBeInTheDocument();
  });
});
