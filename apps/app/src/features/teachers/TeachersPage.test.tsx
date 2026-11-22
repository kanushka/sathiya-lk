// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx, entries } from '@sathiya/core/fixtures';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, call } from '../../lib/callable';
import { pickOption } from '../../test/pickOption';
import { renderWithSchool } from '../../test/renderWithSchool';
import * as api from './api';
import { printSlips } from './printSlips';
import { clearSessionPasswords, setSessionPassword } from './sessionPasswords';
import { TeachersPage } from './TeachersPage';

vi.mock('./api');
vi.mock('./printSlips', async (orig) => ({ ...(await orig<typeof import('./printSlips')>()), printSlips: vi.fn() }));
vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));

const flags = vi.hoisted(() => ({ readOnly: false }));
vi.mock('../../ui/AdminLayout', async (orig) => ({ ...(await orig<typeof import('../../ui/AdminLayout')>()), useReadOnly: () => flags.readOnly }));

beforeEach(() => {
  vi.resetAllMocks();
  flags.readOnly = false;
  clearSessionPasswords();
  vi.mocked(printSlips).mockResolvedValue(true);
});

const render = () => renderWithSchool(<TeachersPage />, { ctx, entries });

async function openAdd(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '+ Add teacher' }));
  return screen.getByRole('dialog');
}

describe('teachers page', () => {
  it('lists teachers and filters by name or staff ID', async () => {
    const user = userEvent.setup();
    render();
    expect(screen.getByText('Mrs. N. Perera')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'scc011');
    expect(screen.getByText('Mr. R. Silva')).toBeInTheDocument();
    expect(screen.queryByText('Mrs. N. Perera')).not.toBeInTheDocument();
  });

  it('colours the never-logged-in cell red', () => {
    render();
    const reds = document.querySelectorAll('td span.text-danger');
    expect(reds.length).toBeGreaterThan(0);
    expect(reds[0]!.closest('td')).not.toHaveClass('text-danger');
  });

  it('hides the subject picker for a primary teacher', async () => {
    const user = userEvent.setup();
    render();
    const dialog = await openAdd(user);
    expect(within(dialog).getByText('Subjects')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: /Primary teacher/ }));
    expect(within(dialog).queryByText('Subjects')).not.toBeInTheDocument();
  });

  it('prefills the next staff ID', async () => {
    const user = userEvent.setup();
    render();
    const dialog = await openAdd(user);
    expect(within(dialog).getByLabelText('Staff ID')).toHaveValue('SCC059');
  });

  it('creates a teacher and shows the returned password on the slip', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTeacher).mockResolvedValue({ teacherId: 'tNew', password: 'k7m4x9pq' });
    render();
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByLabelText('Name'), 'Mr. New Teacher');
    await pickOption(user, within(dialog).getByRole('combobox', { name: 'Subjects' }), 'Mathematics');
    await user.click(within(dialog).getByRole('button', { name: '6', pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));

    expect(await within(dialog).findByText('k7m4x9pq')).toBeInTheDocument();
    expect(api.createTeacher).toHaveBeenCalledWith(
      'siripura',
      expect.objectContaining({ staffId: 'SCC059', name: 'Mr. New Teacher', isPrimary: false, grades: [6], maxPerDay: 7 }),
    );
    const sent = vi.mocked(api.createTeacher).mock.calls[0]![1];
    expect(Object.values(sent)).not.toContain(undefined);
    expect(within(dialog).getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href')).toContain(
      encodeURIComponent('k7m4x9pq'),
    );
  });

  it('shows only the login slip after creating a teacher', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTeacher).mockResolvedValue({ teacherId: 'tNew', password: 'k7m4x9pq' });
    render();
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByLabelText('Name'), 'New Teacher');
    await pickOption(user, within(dialog).getByRole('combobox', { name: 'Subjects' }), 'Mathematics');
    await user.click(within(dialog).getByRole('button', { name: '6', pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));

    expect(await within(dialog).findByText('k7m4x9pq')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Name')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Staff ID')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/already used/i)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Print slip' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('moves focus to the slip Print button after creating a teacher', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTeacher).mockResolvedValue({ teacherId: 'tNew', password: 'k7m4x9pq' });
    render();
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByLabelText('Name'), 'New Teacher');
    await pickOption(user, within(dialog).getByRole('combobox', { name: 'Subjects' }), 'Mathematics');
    await user.click(within(dialog).getByRole('button', { name: '6', pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));

    expect(await within(dialog).findByText('k7m4x9pq')).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Print slip' })).toHaveFocus());
  });

  it('shows a new password after reset', async () => {
    const user = userEvent.setup();
    vi.mocked(api.resetTeacherPassword).mockResolvedValue('n3w8pass');
    render();
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Reset to get a new password')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Reset password' }));
    expect(await within(dialog).findByText('n3w8pass')).toBeInTheDocument();
    expect(api.resetTeacherPassword).toHaveBeenCalledWith('siripura', expect.any(String));
  });

  it('updates an existing teacher without the callable', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateTeacher).mockResolvedValue(undefined);
    render();
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Staff ID')).toBeDisabled();
    await user.clear(within(dialog).getByLabelText('Max periods / day'));
    await user.type(within(dialog).getByLabelText('Max periods / day'), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    await waitFor(() => expect(api.updateTeacher).toHaveBeenCalled());
    expect(api.updateTeacher).toHaveBeenCalledWith('siripura', expect.any(String), expect.objectContaining({ maxPerDay: 5 }));
    expect(api.createTeacher).not.toHaveBeenCalled();
  });

  it('prints slips with session passwords and reset-needed for the rest', async () => {
    const user = userEvent.setup();
    const perera = ctx.teachers.find((t) => t.staffId === 'SCC024')!;
    setSessionPassword('test-user:siripura', perera.id, 'abcd2345');
    render();
    await user.click(screen.getByRole('button', { name: 'Print all login slips' }));
    await waitFor(() => expect(printSlips).toHaveBeenCalled());
    const slips = vi.mocked(printSlips).mock.calls[0]![0];
    expect(slips.find((s) => s.staffId === 'SCC024')?.password).toBe('abcd2345');
    expect(slips.find((s) => s.staffId === 'SCC011')?.password).toBeUndefined();
    expect(slips[0]!.url).toBe(`${window.location.origin}/login?as=teacher&school=siripura`);
  });

  it('blocks deleting an in-use teacher and shows the count', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockResolvedValue({ deleted: false, usedIn: 12 });
    render();
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/Used in 12 slots/)).toBeInTheDocument();
    expect(call).toHaveBeenCalledWith('deleteSetupItem', { schoolId: 'siripura', kind: 'teacher', id: expect.any(String) });
  });

  it('treats an in-use ApiError as blocked too', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockRejectedValue(new ApiError('in-use', 'in use', { usedIn: 3 }));
    render();
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/Used in 3 slots/)).toBeInTheDocument();
  });

  it('saves an edit to a teacher whose staff ID uses an old prefix', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateTeacher).mockResolvedValue(undefined);
    renderWithSchool(<TeachersPage />, { ctx: { ...ctx, school: { ...ctx.school, staffPrefix: 'XYZ' } }, entries });
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    await waitFor(() => expect(api.updateTeacher).toHaveBeenCalled());
  });

  it('creates a teacher with a title kept apart from the name', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTeacher).mockResolvedValue({ teacherId: 'tNew', password: 'k7m4x9pq' });
    render();
    const dialog = await openAdd(user);
    const title = within(dialog).getByRole('combobox', { name: /^Title/ });
    await user.click(title);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['—', 'Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Rev.', 'Ven.', 'Thero']);
    await user.click(screen.getByRole('option', { name: 'Thero' }));
    await user.type(within(dialog).getByLabelText('Name'), 'Ananda');
    await pickOption(user, within(dialog).getByRole('combobox', { name: 'Subjects' }), 'Mathematics');
    await user.click(within(dialog).getByRole('button', { name: '6', pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    await waitFor(() => expect(api.createTeacher).toHaveBeenCalled());
    expect(api.createTeacher).toHaveBeenCalledWith('siripura', expect.objectContaining({ title: 'Thero', name: 'Ananda' }));
  });

  it('moves a legacy name prefix into the title when editing', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateTeacher).mockResolvedValue(undefined);
    const legacy = { ...ctx, teachers: ctx.teachers.map(({ title: _, ...t }) => (t.staffId === 'SCC024' ? { ...t, name: 'Mrs. N. Perera' } : t)) };
    const perera = legacy.teachers.find((t) => t.staffId === 'SCC024')!;
    renderWithSchool(<TeachersPage />, { ctx: legacy, entries });
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('combobox', { name: /^Title/ })).toHaveTextContent('Mrs.');
    expect(within(dialog).getByLabelText('Name')).toHaveValue('N. Perera');
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    await waitFor(() => expect(api.updateTeacher).toHaveBeenCalled());
    expect(api.updateTeacher).toHaveBeenCalledWith('siripura', perera.id, expect.objectContaining({ title: 'Mrs', name: 'N. Perera' }));
  });

  it('clears a title when set back to none', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateTeacher).mockResolvedValue(undefined);
    render();
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    await pickOption(user, within(dialog).getByRole('combobox', { name: /^Title/ }), '—');
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    await waitFor(() => expect(api.updateTeacher).toHaveBeenCalled());
    expect(vi.mocked(api.updateTeacher).mock.calls[0]![2]).not.toHaveProperty('title');
  });

  it('read-only hides every write control', () => {
    flags.readOnly = true;
    render();
    for (const name of ['+ Add teacher', 'Edit', 'Delete']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('locked modal cannot open the subjects menu', async () => {
    const user = userEvent.setup();
    render();
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    flags.readOnly = true;
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Name/ }), { target: { value: 'Mrs. N. Perera ' } });
    const subjects = within(dialog).getByRole('combobox', { name: /^Subjects/ });
    expect(subjects).toBeDisabled();
    await user.click(subjects);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
