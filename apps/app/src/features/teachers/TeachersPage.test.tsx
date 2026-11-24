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
import { TeachersPage } from './TeachersPage';

vi.mock('./api');
const data = vi.hoisted(() => ({ requests: [] as unknown[] }));
vi.mock('./useJoinRequests', () => ({ useJoinRequests: () => ({ data: data.requests, loading: false }) }));
vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));

const flags = vi.hoisted(() => ({ readOnly: false }));
vi.mock('../../ui/AdminLayout', async (orig) => ({ ...(await orig<typeof import('../../ui/AdminLayout')>()), useReadOnly: () => flags.readOnly }));

beforeEach(() => {
  vi.resetAllMocks();
  flags.readOnly = false;
  data.requests = [];
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

  it('creates a teacher', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTeacher).mockResolvedValue({ teacherId: 'tNew' });
    render();
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByLabelText('Name in English'), 'Mr. New Teacher');
    await pickOption(user, within(dialog).getByRole('combobox', { name: 'Subjects' }), 'Mathematics');
    await user.click(within(dialog).getByRole('button', { name: '6', pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));

    await waitFor(() => expect(api.createTeacher).toHaveBeenCalled());
    expect(api.createTeacher).toHaveBeenCalledWith(
      'siripura',
      expect.objectContaining({ staffId: 'SCC059', name: 'Mr. New Teacher', isPrimary: false, grades: [6], maxPerDay: 7 }),
    );
    const sent = vi.mocked(api.createTeacher).mock.calls[0]![1];
    expect(Object.values(sent)).not.toContain(undefined);
  });

  it('says the school is suspended when creating a teacher is refused for that reason', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTeacher).mockRejectedValue(new ApiError('school-disabled', 'School is suspended'));
    render();
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByLabelText('Name in English'), 'Mr. New Teacher');
    await pickOption(user, within(dialog).getByRole('combobox', { name: 'Subjects' }), 'Mathematics');
    await user.click(within(dialog).getByRole('button', { name: '6', pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    expect(await within(dialog).findByText("This school is suspended, so changes can't be saved.")).toBeInTheDocument();
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
    vi.mocked(api.createTeacher).mockResolvedValue({ teacherId: 'tNew' });
    render();
    const dialog = await openAdd(user);
    const title = within(dialog).getByRole('combobox', { name: /^Title/ });
    await user.click(title);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['—', 'Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Rev.', 'Ven.']);
    expect(screen.queryByRole('combobox', { name: 'Search' })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'Ven.' }));
    await user.type(within(dialog).getByLabelText('Name in English'), 'Ananda Thero');
    await pickOption(user, within(dialog).getByRole('combobox', { name: 'Subjects' }), 'Mathematics');
    await user.click(within(dialog).getByRole('button', { name: '6', pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    await waitFor(() => expect(api.createTeacher).toHaveBeenCalled());
    expect(api.createTeacher).toHaveBeenCalledWith('siripura', expect.objectContaining({ title: 'Ven.', name: 'Ananda Thero' }));
  });

  it('creates a teacher with only a Sinhala name and refuses one with no name', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTeacher).mockResolvedValue({ teacherId: 'tNew' });
    render();
    const dialog = await openAdd(user);
    await pickOption(user, within(dialog).getByRole('combobox', { name: 'Subjects' }), 'Mathematics');
    await user.click(within(dialog).getByRole('button', { name: '6', pressed: false }));
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    expect(within(dialog).getByText('Enter the name in English or Sinhala (or both).')).toBeInTheDocument();
    expect(api.createTeacher).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText('Name in Sinhala'), 'ජී. ජයසේකර');
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    await waitFor(() => expect(api.createTeacher).toHaveBeenCalledWith('siripura', expect.objectContaining({ name: '', nameSi: 'ජී. ජයසේකර' })));
  });

  it('shows the other-language name and flags a missing one', () => {
    const named = { ...ctx, teachers: ctx.teachers.map((t) => (t.staffId === 'SCC024' ? { ...t, nameSi: 'එන්. පෙරේරා' } : t)) };
    renderWithSchool(<TeachersPage />, { ctx: named, entries });
    const perera = screen.getByText('Mrs. N. Perera').closest('tr')!;
    expect(within(perera).getByText('එන්. පෙරේරා මහත්මිය')).toBeInTheDocument();
    expect(screen.queryByText('No English name')).toBeNull();
  });

  it('flags teachers without a Sinhala name on Sinhala screens', () => {
    renderWithSchool(<TeachersPage />, { ctx, entries, lang: 'si' });
    expect(screen.getAllByText('සිංහල නමක් නැත').length).toBe(ctx.teachers.length);
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
    expect(within(dialog).getByLabelText('Name in English')).toHaveValue('N. Perera');
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
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name in English' }), { target: { value: 'Mrs. N. Perera ' } });
    const subjects = within(dialog).getByRole('combobox', { name: /^Subjects/ });
    expect(subjects).toBeDisabled();
    await user.click(subjects);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

const perera = ctx.teachers.find((t) => t.staffId === 'SCC024')!;
const rizan = ctx.teachers.find((t) => t.staffId === 'SCC031')!;
const silva = ctx.teachers.find((t) => t.staffId === 'SCC011')!;
const linkedCtx = {
  ...ctx,
  teachers: ctx.teachers.map((t) => (t.id === perera.id ? { ...t, uid: 'u-perera', lastLoginAt: Date.UTC(2026, 10, 20, 8, 30) } : t)),
};
const request = { id: 'u-rizan', uid: 'u-rizan', email: 'rizan@gmail.com', name: 'A Rizan', staffId: 'SCC031', teacherId: rizan.id, createdAt: 1 };
const rowOf = (staffId: string) => screen.getByText(staffId).closest('tr')!;
const renderLinked = (claims?: Parameters<typeof renderWithSchool>[1]['claims']) =>
  renderWithSchool(<TeachersPage />, { ctx: linkedCtx, entries, ...(claims && { claims }) });

describe('teacher accounts', () => {
  it('shows Not linked, Pending and Linked with the last login', () => {
    data.requests = [request];
    renderLinked();
    expect(screen.getByRole('columnheader', { name: 'Account' })).toBeInTheDocument();
    expect(within(rowOf('SCC024')).getByText('Linked')).toBeInTheDocument();
    expect(within(rowOf('SCC024')).getByText(/Last login/)).toBeInTheDocument();
    expect(within(rowOf('SCC031')).getByText('Pending')).toBeInTheDocument();
    expect(within(rowOf('SCC011')).getByText('Not linked')).toBeInTheDocument();
  });

  it('lists join requests and approves one through decideJoinRequest', async () => {
    vi.mocked(api.decideJoinRequest).mockResolvedValue(undefined);
    data.requests = [request];
    const user = userEvent.setup();
    renderLinked();
    const section = screen.getByRole('region', { name: 'Join requests (1)' });
    expect(within(section).getByText('A Rizan')).toBeInTheDocument();
    expect(within(section).getByText('rizan@gmail.com')).toBeInTheDocument();
    expect(within(section).getByText(/Mr\. A\. Rizan · SCC031/)).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: 'Approve' }));
    expect(api.decideJoinRequest).toHaveBeenCalledWith('siripura', 'u-rizan', true);
  });

  it('rejects a join request', async () => {
    vi.mocked(api.decideJoinRequest).mockResolvedValue(undefined);
    data.requests = [request];
    const user = userEvent.setup();
    renderLinked();
    await user.click(within(screen.getByRole('region', { name: 'Join requests (1)' })).getByRole('button', { name: 'Reject' }));
    expect(api.decideJoinRequest).toHaveBeenCalledWith('siripura', 'u-rizan', false);
  });

  it('explains a failed approval', async () => {
    vi.mocked(api.decideJoinRequest).mockRejectedValue(new ApiError('already-linked', 'x', { code: 'already-linked' }));
    data.requests = [request];
    const user = userEvent.setup();
    renderLinked();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('This teacher is already linked to an account. Unlink it first.')).toBeInTheDocument();
  });

  it('hides the requests section when there are none', () => {
    renderLinked();
    expect(screen.queryByRole('region', { name: /Join requests/ })).not.toBeInTheDocument();
  });

  it('creates a school invite link, shows and copies it, then replaces and turns it off', async () => {
    vi.mocked(api.setJoinLink).mockResolvedValueOnce({ token: 'tokA' }).mockResolvedValueOnce({ token: 'tokB' }).mockResolvedValueOnce({});
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderLinked();
    const card = screen.getByRole('region', { name: 'Invite link' });
    await user.click(within(card).getByRole('button', { name: 'Create link' }));
    expect(api.setJoinLink).toHaveBeenLastCalledWith('siripura', 'create');
    const url = `${window.location.origin}/join/siripura/tokA`;
    expect(await within(card).findByText(url)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Copy invite link' }));
    expect(writeText).toHaveBeenLastCalledWith(url);
    await user.click(within(card).getByRole('button', { name: 'New link (old one stops working)' }));
    expect(await within(card).findByText(`${window.location.origin}/join/siripura/tokB`)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Turn off link' }));
    expect(api.setJoinLink).toHaveBeenLastCalledWith('siripura', 'off');
    expect(await within(card).findByText('The invite link is off. Nobody can join with an old link.')).toBeInTheDocument();
    expect(within(card).queryByText(/\/join\//)).not.toBeInTheDocument();
  });

  it('creates a personal link that shows its expiry, and can cancel it', async () => {
    vi.mocked(api.createTeacherLink).mockResolvedValue({ token: 'tokP', expiresAt: Date.UTC(2026, 11, 1, 12) });
    vi.mocked(api.cancelTeacherLink).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderLinked();
    await user.click(within(rowOf('SCC011')).getByRole('button', { name: 'Personal link' }));
    expect(api.createTeacherLink).toHaveBeenCalledWith('siripura', silva.id);
    const dialog = await screen.findByRole('dialog', { name: 'Personal link for Mr. R. Silva' });
    expect(within(dialog).getByText(`${window.location.origin}/join/t/tokP`)).toBeInTheDocument();
    expect(within(dialog).getByText(/Works once, until .*Dec/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await user.click(within(rowOf('SCC011')).getByRole('button', { name: 'Cancel link' }));
    expect(api.cancelTeacherLink).toHaveBeenCalledWith('siripura', silva.id);
    expect(await screen.findByText('Personal link cancelled')).toBeInTheDocument();
  });

  it('unlinks a linked teacher after a confirmation', async () => {
    vi.mocked(api.unlinkTeacher).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderLinked();
    const row = rowOf('SCC024');
    expect(within(row).queryByRole('button', { name: 'Personal link' })).not.toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Unlink' }));
    expect(api.unlinkTeacher).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Unlink Mrs. N. Perera?' });
    await user.click(within(dialog).getByRole('button', { name: 'Unlink' }));
    expect(api.unlinkTeacher).toHaveBeenCalledWith('siripura', perera.id);
  });

  it('offers This is me to an admin with no teacher record and links it', async () => {
    vi.mocked(api.linkSelf).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderLinked();
    expect(within(rowOf('SCC024')).queryByRole('button', { name: 'This is me' })).not.toBeInTheDocument();
    await user.click(within(rowOf('SCC011')).getByRole('button', { name: 'This is me' }));
    expect(api.linkSelf).toHaveBeenCalledWith('siripura', silva.id);
  });

  it('hides This is me for an admin already linked to a teacher', () => {
    renderLinked({ schools: { siripura: { r: 'a', t: perera.id } } });
    expect(screen.queryByRole('button', { name: 'This is me' })).not.toBeInTheDocument();
  });

  it('has no password or login slip controls', async () => {
    const user = userEvent.setup();
    renderLinked();
    expect(screen.queryByRole('button', { name: /slip/i })).not.toBeInTheDocument();
    await user.click(within(rowOf('SCC011')).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/password|slip/i)).not.toBeInTheDocument();
  });

  it('read-only shows requests and statuses without link actions', () => {
    flags.readOnly = true;
    data.requests = [request];
    renderLinked();
    expect(screen.queryByRole('region', { name: 'Invite link' })).not.toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Join requests (1)' });
    expect(within(section).queryByRole('button')).not.toBeInTheDocument();
    for (const name of ['Personal link', 'Cancel link', 'Unlink', 'This is me']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});
