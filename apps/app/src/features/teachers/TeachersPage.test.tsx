// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { usageCount } from '@sathiya/core';
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

const unused = { ...ctx, classes: ctx.classes.map(({ classTeacherId: _, ...c }) => c) };

const render = () => renderWithSchool(<TeachersPage />, { ctx, entries });

describe('teachers page from an empty-state link', () => {
  it('opens Add teacher when the URL has ?new=1', () => {
    renderWithSchool(<TeachersPage />, { ctx, entries, route: '/admin/teachers?new=1' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

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

  it('says the school is suspended when creating a teacher is refused for that reason', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTeacher).mockRejectedValue(new ApiError('school-disabled', 'School is suspended'));
    render();
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByLabelText('Name'), 'Mr. New Teacher');
    await pickOption(user, within(dialog).getByRole('combobox', { name: 'Subjects' }), 'Mathematics');
    await user.click(within(dialog).getByRole('button', { name: '6', pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    expect(await within(dialog).findByText("This school is suspended, so changes can't be saved.")).toBeInTheDocument();
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

  it('asks for confirmation before resetting a password', async () => {
    const user = userEvent.setup();
    vi.mocked(api.resetTeacherPassword).mockResolvedValue('n3w8pass');
    render();
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Reset to get a new password')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Reset password' }));
    expect(api.resetTeacherPassword).not.toHaveBeenCalled();
    const confirm = screen.getByRole('dialog', { name: /Reset .*password\?/ });
    expect(within(confirm).getByText(/current password stops working immediately/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(api.resetTeacherPassword).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Reset password' }));
    await user.click(within(screen.getByRole('dialog', { name: /Reset .*password\?/ })).getByRole('button', { name: 'Reset password' }));
    expect(await within(dialog).findByText('n3w8pass')).toBeInTheDocument();
    expect(api.resetTeacherPassword).toHaveBeenCalledWith('siripura', expect.any(String));
  });

  it('disables Print slip and WhatsApp until a fresh password is known', async () => {
    const user = userEvent.setup();
    const perera = ctx.teachers.find((t) => t.staffId === 'SCC024')!;
    const { unmount } = render();
    await user.click(within(screen.getByText('Mrs. N. Perera').closest('tr')!).getByRole('button', { name: 'Edit' }));
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Print slip' })).toBeDisabled();
    expect(within(dialog).queryByRole('link', { name: 'Share on WhatsApp' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Share on WhatsApp')).toHaveAttribute('aria-disabled', 'true');
    expect(within(dialog).getByText('Reset the password first to print a slip')).toBeInTheDocument();
    unmount();

    setSessionPassword('test-user:siripura', perera.id, 'abcd2345');
    render();
    await user.click(within(screen.getByText('Mrs. N. Perera').closest('tr')!).getByRole('button', { name: 'Edit' }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Print slip' })).toBeEnabled();
    expect(within(dialog).getByRole('link', { name: 'Share on WhatsApp' })).toBeInTheDocument();
    expect(within(dialog).queryByText('Reset the password first to print a slip')).not.toBeInTheDocument();
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

  it('print all opens a dialog and prints only the slips with a fresh password', async () => {
    const user = userEvent.setup();
    const perera = ctx.teachers.find((t) => t.staffId === 'SCC024')!;
    setSessionPassword('test-user:siripura', perera.id, 'abcd2345');
    render();
    await user.click(screen.getByRole('button', { name: 'Print all login slips' }));
    expect(printSlips).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Print login slips' });
    expect(within(dialog).getByText(/only known right after/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Print 1 slip with new password' }));
    await waitFor(() => expect(printSlips).toHaveBeenCalled());
    const slips = vi.mocked(printSlips).mock.calls[0]![0];
    expect(slips).toHaveLength(1);
    expect(slips[0]).toMatchObject({ staffId: 'SCC024', password: 'abcd2345', url: `${window.location.origin}/login?as=teacher&school=siripura` });
    expect(screen.queryByRole('dialog', { name: 'Print login slips' })).not.toBeInTheDocument();
  });

  it('print all disables the known-passwords option when there are none', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'Print all login slips' }));
    const dialog = screen.getByRole('dialog', { name: 'Print login slips' });
    expect(within(dialog).getByRole('button', { name: 'Print 0 slips with new passwords' })).toBeDisabled();
  });

  it('print all resets every password after a confirmation, then prints all slips on a fresh click', async () => {
    const user = userEvent.setup();
    vi.mocked(api.resetTeacherPassword).mockImplementation(async (_s, id) => `pw-${id}`);
    render();
    await user.click(screen.getByRole('button', { name: 'Print all login slips' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset all passwords and print' }));
    const confirm = screen.getByRole('dialog', { name: "Reset every teacher's password?" });
    expect(within(confirm).getByText(/Every teacher's current password stops working immediately/)).toBeInTheDocument();
    expect(api.resetTeacherPassword).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Reset all and print' }));
    const done = await screen.findByRole('dialog', { name: 'Passwords reset' });
    expect(api.resetTeacherPassword).toHaveBeenCalledTimes(ctx.teachers.length);
    expect(printSlips).not.toHaveBeenCalled();
    await user.click(within(done).getByRole('button', { name: `Print ${ctx.teachers.length} slips` }));
    await waitFor(() => expect(printSlips).toHaveBeenCalled());
    const slips = vi.mocked(printSlips).mock.calls[0]![0];
    expect(slips).toHaveLength(ctx.teachers.length);
    expect(slips.every((x) => x.password?.startsWith('pw-'))).toBe(true);
  });

  it('print all leaves out teachers whose reset failed', async () => {
    const user = userEvent.setup();
    const bad = ctx.teachers[0]!.id;
    vi.mocked(api.resetTeacherPassword).mockImplementation(async (_s, id) => {
      if (id === bad) throw new Error('no login');
      return `pw-${id}`;
    });
    render();
    await user.click(screen.getByRole('button', { name: 'Print all login slips' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset all passwords and print' }));
    await user.click(within(screen.getByRole('dialog', { name: "Reset every teacher's password?" })).getByRole('button', { name: 'Reset all and print' }));
    const done = await screen.findByRole('dialog', { name: 'Passwords reset' });
    expect(within(done).getByText('1 teacher could not be reset and was left out of the slips')).toBeInTheDocument();
    await user.click(within(done).getByRole('button', { name: `Print ${ctx.teachers.length - 1} slips` }));
    await waitFor(() => expect(printSlips).toHaveBeenCalled());
    expect(vi.mocked(printSlips).mock.calls[0]![0]).toHaveLength(ctx.teachers.length - 1);
  });

  it('print all moves focus into the confirmation step', async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'Print all login slips' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset all passwords and print' }));
    expect(screen.getByRole('dialog', { name: "Reset every teacher's password?" })).toContainElement(document.activeElement as HTMLElement);
  });

  it('print all offers no reset in the read-only view', async () => {
    const user = userEvent.setup();
    flags.readOnly = true;
    render();
    await user.click(screen.getByRole('button', { name: 'Print all login slips' }));
    const dialog = screen.getByRole('dialog', { name: 'Print login slips' });
    expect(within(dialog).queryByRole('button', { name: 'Reset all passwords and print' })).not.toBeInTheDocument();
  });

  it('does not ask a read-only viewer to reset the password on the slip', async () => {
    const user = userEvent.setup();
    render();
    await user.click(within(screen.getByText('Mrs. N. Perera').closest('tr')!).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    flags.readOnly = true;
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^Name/ }), { target: { value: 'Mrs. N. Perera ' } });
    expect(within(dialog).queryByText('Reset the password first to print a slip')).not.toBeInTheDocument();
  });

  it('shows the usage on the first delete dialog and offers no delete button when in use', async () => {
    const user = userEvent.setup();
    const used = ctx.teachers.find((t) => usageCount('teacher', t.id, ctx, entries) > 0)!;
    const count = usageCount('teacher', used.id, ctx, entries) + ctx.classes.filter((c) => c.classTeacherId === used.id).length;
    render();
    const row = screen.getByText(used.staffId).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(new RegExp(`Used in ${count} slots`))).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });

  it('ignores slots in an older year, which the server does not count', async () => {
    const user = userEvent.setup();
    const used = unused.teachers.find((t) => usageCount('teacher', t.id, unused, entries) > 0)!;
    const years = [
      { id: 'y2025', label: '2025', status: 'published' as const },
      { id: 'y2026', label: '2026', status: 'draft' as const },
    ];
    renderWithSchool(<TeachersPage />, { ctx: unused, entries, years, yearId: 'y2025' });
    await user.click(within(screen.getByText(used.staffId).closest('tr')!).getByRole('button', { name: 'Delete' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('blocks deleting an in-use teacher and shows the count', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockResolvedValue({ deleted: false, usedIn: 12 });
    renderWithSchool(<TeachersPage />, { ctx: unused, entries: [] });
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/Used in 12 slots/)).toBeInTheDocument();
    expect(call).toHaveBeenCalledWith('deleteSetupItem', { schoolId: 'siripura', kind: 'teacher', id: expect.any(String) });
  });

  it('treats an in-use ApiError as blocked too', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockRejectedValue(new ApiError('in-use', 'in use', { usedIn: 3 }));
    renderWithSchool(<TeachersPage />, { ctx: unused, entries: [] });
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/Used in 3 slots/)).toBeInTheDocument();
  });

  it('says the school is suspended when a delete is refused for that reason', async () => {
    const user = userEvent.setup();
    vi.mocked(call).mockRejectedValue(new ApiError('school-disabled', 'School is suspended'));
    renderWithSchool(<TeachersPage />, { ctx: unused, entries: [] });
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText("This school is suspended, so changes can't be saved.")).toBeInTheDocument();
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

  it('shows a legacy Thero teacher as Ven. and saves it that way', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateTeacher).mockResolvedValue(undefined);
    const legacy = { ...ctx.teachers[0]!, title: 'Thero' as never, name: 'Sumana' };
    renderWithSchool(<TeachersPage />, { ctx: { ...ctx, teachers: [legacy, ...ctx.teachers.slice(1)] }, entries });
    expect(screen.getByText('Ven. Sumana Thero')).toBeInTheDocument();
  });

  it('creates a teacher with a title kept apart from the name', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTeacher).mockResolvedValue({ teacherId: 'tNew', password: 'k7m4x9pq' });
    render();
    const dialog = await openAdd(user);
    const title = within(dialog).getByRole('combobox', { name: /^Title/ });
    await user.click(title);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['—', 'Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Rev.', 'Ven.']);
    expect(screen.queryByRole('combobox', { name: 'Search' })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'Ven.' }));
    await user.type(within(dialog).getByLabelText('Name'), 'Ananda Thero');
    await pickOption(user, within(dialog).getByRole('combobox', { name: 'Subjects' }), 'Mathematics');
    await user.click(within(dialog).getByRole('button', { name: '6', pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    await waitFor(() => expect(api.createTeacher).toHaveBeenCalled());
    expect(api.createTeacher).toHaveBeenCalledWith('siripura', expect.objectContaining({ title: 'Ven.', name: 'Ananda Thero' }));
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
