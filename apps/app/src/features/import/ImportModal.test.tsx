// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx, entries } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, call } from '../../lib/callable';
import { renderWithSchool } from '../../test/renderWithSchool';
import { SubjectsPage } from '../subjects/SubjectsPage';
import { printSlips } from '../teachers/printSlips';
import { clearSessionPasswords } from '../teachers/sessionPasswords';
import { TeachersPage } from '../teachers/TeachersPage';
import { ImportModal } from './ImportModal';
import { downloadBlob, templateCsv } from './template';

vi.mock('../teachers/printSlips', async (orig) => ({ ...(await orig<typeof import('../teachers/printSlips')>()), printSlips: vi.fn() }));
vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));
vi.mock('./template', async (orig) => ({ ...(await orig<typeof import('./template')>()), downloadBlob: vi.fn() }));

const flags = vi.hoisted(() => ({ readOnly: false }));
vi.mock('../../ui/AdminLayout', async (orig) => ({ ...(await orig<typeof import('../../ui/AdminLayout')>()), useReadOnly: () => flags.readOnly }));

beforeEach(() => {
  vi.resetAllMocks();
  flags.readOnly = false;
  clearSessionPasswords();
  vi.mocked(printSlips).mockResolvedValue(true);
});

const SUBJECTS_CSV = 'Name (English),Name (Sinhala),Short name\nDrama,නාට්‍ය,Drama\n';
const TEACHERS_HEAD = 'Staff ID,Title,Full name,Subjects,Grades\n';
const csv = (text: string, name: string) => new File([text], name, { type: 'text/csv' });

function open(onClose = vi.fn()) {
  renderWithSchool(<ImportModal onClose={onClose} />, { ctx, entries });
  return screen.getByRole('dialog', { name: 'Import subjects and teachers' });
}

async function choose(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, file: File) {
  await user.upload(within(dialog).getByLabelText('Choose file'), file);
}

describe('ImportModal preview', () => {
  it('summarises a valid subjects file and imports it', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockResolvedValue({ subjectIds: ['new'], teachers: [], notCreated: [] });
    const dialog = open();
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled();

    await choose(user, dialog, csv(SUBJECTS_CSV, 'subjects.csv'));

    expect(await within(dialog).findByText('1 subject, 0 teachers to add')).toBeInTheDocument();
    const importButton = within(dialog).getByRole('button', { name: 'Import' });
    expect(importButton).toBeEnabled();
    await user.click(importButton);

    expect(call).toHaveBeenCalledWith('importSetup', {
      schoolId: ctx.school.id,
      subjects: [{ row: 2, cells: { nameEn: 'Drama', nameSi: 'නාට්‍ය', short: 'Drama' } }],
      teachers: [],
    });
    const done = await screen.findByRole('dialog', { name: 'Import complete' });
    expect(within(done).getByText('Added 1 subject and 0 teachers.')).toBeInTheDocument();
    expect(within(done).getByRole('button', { name: 'Print login slips' })).toBeDisabled();
  });

  it('lists the teachers to add', async () => {
    const user = userEvent.setup();
    const dialog = open();
    await choose(user, dialog, csv(`${TEACHERS_HEAD},Mrs,A. Perera,Mathematics,6-7\n`, 'teachers.csv'));
    expect(await within(dialog).findByText('0 subjects, 1 teacher to add')).toBeInTheDocument();
    expect(within(dialog).getByText('SCC059')).toBeInTheDocument();
    expect(within(dialog).getByText('Mrs. A. Perera')).toBeInTheDocument();
  });

  it('shows row errors with translated messages and blocks import', async () => {
    const user = userEvent.setup();
    const dialog = open();
    await choose(user, dialog, csv(`${TEACHERS_HEAD},Mr,B. Silva,Astrology,6\n`, 'teachers.csv'));

    const table = await within(dialog).findByRole('table');
    const row = within(table).getByRole('row', { name: /Astrology/ });
    expect(within(row).getByText('Teachers')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(within(row).getByText('Subjects')).toBeInTheDocument();
    expect(within(row).getByText('Unknown subject: Astrology')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('replaces the preview when another file is chosen', async () => {
    const user = userEvent.setup();
    const dialog = open();
    await choose(user, dialog, csv(`${TEACHERS_HEAD},Mr,B. Silva,Astrology,6\n`, 'teachers.csv'));
    await within(dialog).findByRole('table');
    await choose(user, dialog, csv(SUBJECTS_CSV, 'subjects.csv'));
    expect(await within(dialog).findByText('1 subject, 0 teachers to add')).toBeInTheDocument();
    expect(within(dialog).queryByRole('table')).not.toBeInTheDocument();
  });

  it('rejects unsupported files', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const dialog = open();
    await choose(user, dialog, new File(['x'], 'notes.txt'));
    expect(await within(dialog).findByText('Choose an .xlsx or .csv file.')).toBeInTheDocument();
  });

  it('says so when the file has no rows', async () => {
    const user = userEvent.setup();
    const dialog = open();
    await choose(user, dialog, csv(templateCsv('subjects'), 'subjects.csv'));
    expect(await within(dialog).findByText('The file has no rows to import.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('downloads a CSV template', async () => {
    const user = userEvent.setup();
    const dialog = open();
    await user.click(within(dialog).getByRole('button', { name: 'CSV: Teachers' }));
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'sathiya-teachers.csv');
  });
});

describe('ImportModal import', () => {
  it('prints a slip per created teacher with their passwords', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockResolvedValue({
      subjectIds: [],
      teachers: [
        { teacherId: 't1', staffId: 'SCC059', name: 'A. Perera', title: 'Mrs', password: 'pass2345' },
        { teacherId: 't2', staffId: 'SCC060', name: 'B. Silva', password: 'word6789' },
      ],
      notCreated: [],
    });
    const dialog = open();
    await choose(user, dialog, csv(`${TEACHERS_HEAD},Mrs,A. Perera,Mathematics,6\n,,B. Silva,Science,7\n`, 'teachers.csv'));
    await user.click(await within(dialog).findByRole('button', { name: 'Import' }));

    const done = await screen.findByRole('dialog', { name: 'Import complete' });
    expect(within(done).getByText('Added 0 subjects and 2 teachers.')).toBeInTheDocument();
    await user.click(within(done).getByRole('button', { name: 'Print login slips' }));
    await waitFor(() => expect(printSlips).toHaveBeenCalled());
    const url = `${window.location.origin}/login?as=teacher&school=${ctx.school.id}`;
    expect(vi.mocked(printSlips).mock.calls[0]![0]).toEqual([
      { schoolName: ctx.school.nameEn, staffId: 'SCC059', name: 'Mrs. A. Perera', password: 'pass2345', url },
      { schoolName: ctx.school.nameEn, staffId: 'SCC060', name: 'B. Silva', password: 'word6789', url },
    ]);
  });

  it('warns about teachers the server could not create', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockResolvedValue({ subjectIds: [], teachers: [], notCreated: ['SCC059'] });
    const dialog = open();
    await choose(user, dialog, csv(`${TEACHERS_HEAD},Mrs,A. Perera,Mathematics,6\n`, 'teachers.csv'));
    await user.click(await within(dialog).findByRole('button', { name: 'Import' }));
    const done = await screen.findByRole('dialog', { name: 'Import complete' });
    expect(within(done).getByRole('alert')).toHaveTextContent("These teachers couldn't be added: SCC059.");
  });

  it('shows server-found errors in the table', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockRejectedValue(
      new ApiError('invalid', 'Import has errors', {
        code: 'invalid',
        errors: [{ sheet: 'teachers', row: 2, column: 'staffId', code: 'staffIdTaken', params: { value: 'SCC059' } }],
      }),
    );
    const dialog = open();
    await choose(user, dialog, csv(`${TEACHERS_HEAD}SCC059,Mrs,A. Perera,Mathematics,6\n`, 'teachers.csv'));
    await user.click(await within(dialog).findByRole('button', { name: 'Import' }));

    const table = await within(dialog).findByRole('table');
    expect(within(table).getByText('Staff ID SCC059 is already in use')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('shows a generic failure', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockRejectedValue(new ApiError('invalid', 'boom'));
    const dialog = open();
    await choose(user, dialog, csv(SUBJECTS_CSV, 'subjects.csv'));
    await user.click(await within(dialog).findByRole('button', { name: 'Import' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Couldn't import. Try again.");
  });

  it('explains a suspended school', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockRejectedValue(new ApiError('school-disabled', 'disabled'));
    const dialog = open();
    await choose(user, dialog, csv(SUBJECTS_CSV, 'subjects.csv'));
    await user.click(await within(dialog).findByRole('button', { name: 'Import' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("This school is suspended, so changes can't be saved.");
  });
});

describe.each([
  ['TeachersPage', () => <TeachersPage />],
  ['SubjectsPage', () => <SubjectsPage />],
])('%s import button', (_, page) => {
  it('opens the import dialog', async () => {
    const user = userEvent.setup();
    renderWithSchool(page(), { ctx, entries });
    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByRole('dialog', { name: 'Import subjects and teachers' })).toBeInTheDocument();
  });

  it('is hidden when read-only', () => {
    flags.readOnly = true;
    renderWithSchool(page(), { ctx, entries });
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
  });
});

describe('TeachersPage after an import', () => {
  it('remembers the new passwords for Print all', async () => {
    const user = userEvent.setup();
    const [existing] = ctx.teachers;
    vi.mocked(call).mockResolvedValue({
      subjectIds: [],
      teachers: [{ teacherId: existing!.id, staffId: existing!.staffId, name: existing!.name, password: 'pass2345' }],
      notCreated: [],
    });
    renderWithSchool(<TeachersPage />, { ctx, entries });
    await user.click(screen.getByRole('button', { name: 'Import' }));
    const dialog = screen.getByRole('dialog');
    await choose(user, dialog, csv(`${TEACHERS_HEAD},Mrs,A. Perera,Mathematics,6\n`, 'teachers.csv'));
    await user.click(await within(dialog).findByRole('button', { name: 'Import' }));
    await user.click(await screen.findByRole('button', { name: 'Done' }));

    await user.click(screen.getByRole('button', { name: 'Print all login slips' }));
    expect(screen.getByRole('button', { name: 'Print 1 slip with new password' })).toBeEnabled();
  });
});
