// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { teacherLoad, usageCount } from '@sathiya/core';
import { T, ctx, entries, entry, mahasen } from '@sathiya/core/fixtures';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, call } from '../../lib/callable';
import { pickOption } from '../../test/pickOption';
import { renderWithSchool } from '../../test/renderWithSchool';
import * as api from './api';
import { TeachersPage } from './TeachersPage';

vi.mock('./api');
const data = vi.hoisted(() => ({ requests: [] as unknown[], joinLink: undefined as unknown, joinLinkError: undefined as Error | undefined }));
vi.mock('./useJoinRequests', () => ({ useJoinRequests: () => ({ data: data.requests, loading: false }) }));
vi.mock('./useJoinLink', () => ({ useJoinLink: () => ({ data: data.joinLink, loading: false, error: data.joinLinkError }) }));
vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));

const flags = vi.hoisted(() => ({ readOnly: false }));
vi.mock('../../ui/AdminLayout', async (orig) => ({ ...(await orig<typeof import('../../ui/AdminLayout')>()), useReadOnly: () => flags.readOnly }));

beforeEach(() => {
  vi.resetAllMocks();
  flags.readOnly = false;
  data.requests = [];
  data.joinLink = undefined;
  data.joinLinkError = undefined;
});

const unused = { ...ctx, classes: ctx.classes.map(({ classTeacherId: _, ...c }) => c) };

const render = () => renderWithSchool(<TeachersPage />, { ctx, entries });

describe('teachers page from an empty-state link', () => {
  it('opens Add teacher when the URL has ?new=1', () => {
    renderWithSchool(<TeachersPage />, { ctx, entries, route: '/admin/teachers?new=1' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('waits for the teachers to load before ?new=1 opens Add teacher', () => {
    const { rerenderWithSchool } = renderWithSchool(<TeachersPage />, { ctx, entries, loading: true, route: '/admin/teachers?new=1' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerenderWithSchool({ loading: false });
    expect(within(screen.getByRole('dialog')).getByLabelText('Staff ID')).toHaveValue('SCC059');
  });

  it('keeps an open Add teacher dialog and its input when the teachers later fail to load', async () => {
    const user = userEvent.setup();
    const { rerenderWithSchool } = renderWithSchool(<TeachersPage />, { ctx, entries });
    await user.click(screen.getByRole('button', { name: '+ Add teacher' }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Name in English'), 'E. Tester');
    rerenderWithSchool({ error: new Error('denied') });
    expect(within(screen.getByRole('dialog')).getByLabelText('Name in English')).toHaveValue('E. Tester');
  });

  it('disables Add teacher and Import while the teachers load', () => {
    renderWithSchool(<TeachersPage />, { ctx, entries, loading: true });
    expect(screen.getByRole('button', { name: '+ Add teacher' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('disables Add teacher and Import when the teachers fail to load', () => {
    renderWithSchool(<TeachersPage />, { ctx: { ...ctx, teachers: [] }, entries, error: new Error('denied') });
    for (const add of screen.getAllByRole('button', { name: '+ Add teacher' })) expect(add).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
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

  it('shows each teacher load and min per week when set', () => {
    const withMin = { ...ctx, teachers: ctx.teachers.map((x, i) => (x.id === T.perera ? { ...x, minPerWeek: 12 } : x)) };
    renderWithSchool(<TeachersPage />, { ctx: withMin, entries });
    const load = teacherLoad(T.perera, entries, withMin);
    expect(load.entries).toBeGreaterThan(0);
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    expect(within(row).getByText('min 12/wk')).toBeInTheDocument();
    expect(load.timedMinutes).toBe(0);
    const expected = String(load.entries);
    expect(within(row).getAllByRole('cell')[5]).toHaveTextContent(expected);
    const other = screen.getByText('Mr. R. Silva').closest('tr')!;
    expect(within(other).queryByText(/min \d+\/wk/)).not.toBeInTheDocument();
  });

  it('shows minutes only for teachers with time-grade slots', () => {
    const es = [entry('m1', 0, 1, ['mh-c-1a'], [[mahasen.S.maths, 'mh-t-1a']])];
    renderWithSchool(<TeachersPage />, { ctx: mahasen.ctx, entries: es });
    expect(within(screen.getByText('Mrs. Grade 1A Teacher').closest('tr')!).getAllByRole('cell')[5]).toHaveTextContent('1 · 1h');
    expect(within(screen.getByText('Mrs. Grade 1B Teacher').closest('tr')!).getAllByRole('cell')[5]).toHaveTextContent(/^0$/);
  });

  it('saves min per week, and validates it against max per day', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createTeacher).mockResolvedValue({ teacherId: 'tNew' });
    render();
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByLabelText('Name in English'), 'Mr. New Teacher');
    await pickOption(user, within(dialog).getByRole('combobox', { name: 'Subjects' }), 'Mathematics');
    await user.click(within(dialog).getByRole('button', { name: '6', pressed: false }));
    await user.type(within(dialog).getByLabelText('Min periods / week (optional)'), '36');
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    expect(await within(dialog).findByText('Enter a whole number from 0 to 35')).toBeInTheDocument();
    expect(api.createTeacher).not.toHaveBeenCalled();
    await user.clear(within(dialog).getByLabelText('Min periods / week (optional)'));
    await user.type(within(dialog).getByLabelText('Min periods / week (optional)'), '20');
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    await waitFor(() => expect(api.createTeacher).toHaveBeenCalled());
    expect(api.createTeacher).toHaveBeenCalledWith('siripura', expect.objectContaining({ minPerWeek: 20 }));
  });

  it('omits minPerWeek when the field is empty', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateTeacher).mockResolvedValue(undefined);
    const withMin = { ...ctx, teachers: ctx.teachers.map((x, i) => (x.id === T.perera ? { ...x, minPerWeek: 12 } : x)) };
    renderWithSchool(<TeachersPage />, { ctx: withMin, entries });
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Min periods / week (optional)')).toHaveValue(12);
    await user.clear(within(dialog).getByLabelText('Min periods / week (optional)'));
    await user.click(within(dialog).getByRole('button', { name: 'Save teacher' }));
    await waitFor(() => expect(api.updateTeacher).toHaveBeenCalled());
    const sent = vi.mocked(api.updateTeacher).mock.calls[0]![2];
    expect(sent).not.toHaveProperty('minPerWeek');
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
    expect(within(section).getByText('Name on their account (not checked): A Rizan')).toBeInTheDocument();
    expect(within(section).getByText('rizan@gmail.com')).toBeInTheDocument();
    expect(within(section).getByText(/Mr\. A\. Rizan · SCC031/)).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: 'Approve' }));
    expect(api.decideJoinRequest).toHaveBeenCalledWith('siripura', 'u-rizan', rizan.id, 1, true);
  });

  it('rejects a join request', async () => {
    vi.mocked(api.decideJoinRequest).mockResolvedValue(undefined);
    data.requests = [request];
    const user = userEvent.setup();
    renderLinked();
    await user.click(within(screen.getByRole('region', { name: 'Join requests (1)' })).getByRole('button', { name: 'Reject' }));
    expect(api.decideJoinRequest).toHaveBeenCalledWith('siripura', 'u-rizan', rizan.id, 1, false);
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

  it('offers Create link when the invite link is off', async () => {
    vi.mocked(api.setJoinLink).mockResolvedValue({ token: 'tokA' });
    const user = userEvent.setup();
    renderLinked();
    const card = screen.getByRole('region', { name: 'Invite link' });
    expect(within(card).getByText(/The invite link is off/)).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Turn off link' })).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Create link' }));
    expect(api.setJoinLink).toHaveBeenCalledWith('siripura', 'create');
  });

  it('shows an error and offers no Create when the invite link cannot be read', () => {
    data.joinLinkError = new Error('permission-denied');
    renderLinked();
    const card = screen.getByRole('region', { name: 'Invite link' });
    expect(within(card).getByText(/Could not load the invite link/)).toBeInTheDocument();
    expect(within(card).queryByText(/The invite link is off/)).not.toBeInTheDocument();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the current invite link for copying, and confirms Turn off', async () => {
    data.joinLink = { id: 'joinLink', token: 'tokA', hash: 'h', createdAt: 1, createdBy: 'u' };
    vi.mocked(api.setJoinLink).mockResolvedValue({});
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderLinked();
    const card = screen.getByRole('region', { name: 'Invite link' });
    const url = `${window.location.origin}/join/siripura/tokA`;
    expect(within(card).getByText(url)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Copy invite link' }));
    expect(writeText).toHaveBeenLastCalledWith(url);
    expect(within(card).queryByRole('button', { name: 'Create link' })).not.toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Turn off link' }));
    const confirm = screen.getByRole('dialog', { name: 'Turn off the invite link?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(api.setJoinLink).not.toHaveBeenCalled();
    await user.click(within(card).getByRole('button', { name: 'Turn off link' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Turn off the invite link?' })).getByRole('button', { name: 'Turn off' }));
    expect(api.setJoinLink).toHaveBeenLastCalledWith('siripura', 'off');
  });

  it('shows the new invite link right after Create link, before the listener catches up', async () => {
    vi.mocked(api.setJoinLink).mockResolvedValue({ token: 'tokB' });
    const user = userEvent.setup();
    renderLinked();
    const card = screen.getByRole('region', { name: 'Invite link' });
    await user.click(within(card).getByRole('button', { name: 'Create link' }));
    expect(api.setJoinLink).toHaveBeenLastCalledWith('siripura', 'create');
    expect(await within(card).findByText(`${window.location.origin}/join/siripura/tokB`)).toBeInTheDocument();
  });

  it('puts join requests above the invite link card', () => {
    data.requests = [request];
    renderLinked();
    const requests = screen.getByRole('region', { name: 'Join requests (1)' });
    const card = screen.getByRole('region', { name: 'Invite link' });
    expect(requests.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the three oldest join requests until Show all is pressed', async () => {
    data.requests = [5, 1, 4, 2, 3].map((n) => ({ ...request, id: `u${n}`, uid: `u${n}`, email: `t${n}@gmail.com`, createdAt: n }));
    const user = userEvent.setup();
    renderLinked();
    const section = screen.getByRole('region', { name: 'Join requests (5)' });
    const emails = () => within(section).getAllByText(/^t\d@gmail\.com$/).map((e) => e.textContent);
    expect(emails()).toEqual(['t1@gmail.com', 't2@gmail.com', 't3@gmail.com']);
    await user.click(within(section).getByRole('button', { name: 'Show all 5' }));
    expect(emails()).toHaveLength(5);
    await user.click(within(section).getByRole('button', { name: 'Show fewer' }));
    expect(emails()).toHaveLength(3);
  });

  it('has no Show all button with three or fewer join requests', () => {
    data.requests = [1, 2, 3].map((n) => ({ ...request, id: `u${n}`, uid: `u${n}`, createdAt: n }));
    renderLinked();
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it('spins only the clicked request button', async () => {
    let finish: () => void = () => undefined;
    vi.mocked(api.decideJoinRequest).mockImplementation(() => new Promise<void>((r) => (finish = r)));
    data.requests = [request];
    const user = userEvent.setup();
    renderLinked();
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByRole('button', { name: 'Reject' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Approve' })).not.toHaveAttribute('aria-busy');
    finish();
  });

  it('explains an approval refused because the account already has a teacher here', async () => {
    vi.mocked(api.decideJoinRequest).mockRejectedValue(new ApiError('already-linked', 'x', { code: 'already-linked', reason: 'account' }));
    data.requests = [request];
    const user = userEvent.setup();
    renderLinked();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('That account is already linked to another teacher in this school.')).toBeInTheDocument();
  });

  it('shows Cancel link and the expiry only while a personal link is live', () => {
    const live = Date.now() + 86_400_000;
    const withLinks = {
      ...linkedCtx,
      teachers: linkedCtx.teachers.map((t) =>
        t.id === silva.id ? { ...t, inviteExpiresAt: live } : t.id === rizan.id ? { ...t, inviteExpiresAt: Date.now() - 1 } : t,
      ),
    };
    renderWithSchool(<TeachersPage />, { ctx: withLinks, entries });
    expect(within(rowOf('SCC011')).getByRole('button', { name: 'Cancel link' })).toBeInTheDocument();
    expect(within(rowOf('SCC011')).getByRole('img', { name: /Personal link until/ })).toBeInTheDocument();
    expect(within(rowOf('SCC031')).queryByRole('button', { name: 'Cancel link' })).not.toBeInTheDocument();
    expect(within(rowOf('SCC031')).queryByRole('img', { name: /Personal link until/ })).not.toBeInTheDocument();
    expect(within(rowOf('SCC003')).queryByRole('button', { name: 'Cancel link' })).not.toBeInTheDocument();
  });

  it('warns an admin unlinking their own record that they will be signed out', async () => {
    const self = { ...ctx, teachers: ctx.teachers.map((t) => (t.id === perera.id ? { ...t, uid: 'test-user' } : t)) };
    const user = userEvent.setup();
    renderWithSchool(<TeachersPage />, { ctx: self, entries, claims: { schools: { siripura: { r: 'a', t: perera.id } } } });
    await user.click(within(rowOf('SCC024')).getByRole('button', { name: 'Unlink' }));
    expect(within(screen.getByRole('dialog')).getByText(/This is your own record\. You will be signed out/)).toBeInTheDocument();
  });

  it('signs an admin out right after unlinking their own record', async () => {
    vi.mocked(api.unlinkTeacher).mockResolvedValue(undefined);
    const signOut = vi.fn(async () => undefined);
    const self = { ...ctx, teachers: ctx.teachers.map((t) => (t.id === perera.id ? { ...t, uid: 'test-user' } : t)) };
    const user = userEvent.setup();
    renderWithSchool(<TeachersPage />, { ctx: self, entries, signOut, claims: { schools: { siripura: { r: 'a', t: perera.id } } } });
    await user.click(within(rowOf('SCC024')).getByRole('button', { name: 'Unlink' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Unlink' }));
    expect(api.unlinkTeacher).toHaveBeenCalledWith('siripura', perera.id);
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it('keeps the admin signed in after unlinking someone else', async () => {
    vi.mocked(api.unlinkTeacher).mockResolvedValue(undefined);
    const signOut = vi.fn(async () => undefined);
    const user = userEvent.setup();
    renderWithSchool(<TeachersPage />, { ctx: linkedCtx, entries, signOut });
    await user.click(within(rowOf('SCC024')).getByRole('button', { name: 'Unlink' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Unlink' }));
    await waitFor(() => expect(api.unlinkTeacher).toHaveBeenCalled());
    expect(signOut).not.toHaveBeenCalled();
  });

  it('warns an admin deleting their own record and signs them out afterwards', async () => {
    vi.mocked(call).mockResolvedValue({ deleted: true });
    const signOut = vi.fn(async () => undefined);
    const self = { ...unused, teachers: unused.teachers.map((t) => (t.id === perera.id ? { ...t, uid: 'test-user' } : t)) };
    const user = userEvent.setup();
    renderWithSchool(<TeachersPage />, { ctx: self, entries: [], signOut, claims: { schools: { siripura: { r: 'a', t: perera.id } } } });
    await user.click(within(rowOf('SCC024')).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/This is your own record\. You will be signed out/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it('does not warn or sign out when deleting someone else', async () => {
    vi.mocked(call).mockResolvedValue({ deleted: true });
    const signOut = vi.fn(async () => undefined);
    const user = userEvent.setup();
    renderWithSchool(<TeachersPage />, { ctx: unused, entries: [], signOut });
    await user.click(within(rowOf('SCC024')).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/signed out/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(call).toHaveBeenCalled());
    expect(signOut).not.toHaveBeenCalled();
  });

  it('does not warn about signing out when unlinking someone else', async () => {
    const user = userEvent.setup();
    renderLinked();
    await user.click(within(rowOf('SCC024')).getByRole('button', { name: 'Unlink' }));
    expect(within(screen.getByRole('dialog')).queryByText(/signed out/)).not.toBeInTheDocument();
  });

  it('keeps an edit dialog opened while a personal link was being made, and tells the admin instead', async () => {
    let finish!: (v: { token: string; expiresAt: number }) => void;
    vi.mocked(api.createTeacherLink).mockImplementation(() => new Promise((r) => (finish = r)));
    const user = userEvent.setup();
    renderLinked();
    await user.click(within(rowOf('SCC011')).getByRole('button', { name: 'Personal link' }));
    await user.click(within(rowOf('SCC024')).getByRole('button', { name: 'Edit' }));
    const edit = screen.getByRole('dialog', { name: 'Edit teacher' });
    await act(async () => finish({ token: 'tokP', expiresAt: Date.now() + 1000 }));
    expect(await screen.findByText(/personal link for Mr\. R\. Silva was made while another window was open/)).toBeInTheDocument();
    expect(edit).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Personal link for/ })).not.toBeInTheDocument();
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
    cleanup();
    renderWithSchool(<TeachersPage />, {
      ctx: { ...linkedCtx, teachers: linkedCtx.teachers.map((t) => (t.id === silva.id ? { ...t, inviteExpiresAt: Date.now() + 1000_000 } : t)) },
      entries,
    });
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

  it('has no This is me action', () => {
    renderLinked();
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
    for (const name of ['Personal link', 'Cancel link', 'Unlink']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});

describe('teacher name order by school medium', () => {
  const nameInputs = (dialog: HTMLElement) => within(dialog).getAllByRole('textbox').filter((el) => el.getAttribute('lang')).map((el) => el.getAttribute('lang'));

  it('asks for the Sinhala name first when the school teaches in Sinhala', async () => {
    const user = userEvent.setup();
    renderWithSchool(<TeachersPage />, { ctx: { ...ctx, school: { ...ctx.school, medium: ['si', 'en'] } }, entries });
    expect(nameInputs(await openAdd(user))).toEqual(['si', 'en']);
  });

  it.each([['English', ['en']], ['legacy (no medium)', undefined]] as const)('keeps English first for %s', async (_, medium) => {
    const user = userEvent.setup();
    renderWithSchool(<TeachersPage />, { ctx: { ...ctx, school: { ...ctx.school, medium: medium && [...medium] } }, entries });
    expect(nameInputs(await openAdd(user))).toEqual(['en', 'si']);
  });
});

describe('teachers page while the school is pending review', () => {
  const pending = { ...ctx, school: { ...ctx.school, status: 'pending' as const } };

  it('locks the invite link card with the approval note', () => {
    renderWithSchool(<TeachersPage />, { ctx: pending, entries });
    const card = screen.getByRole('region', { name: 'Invite link' });
    expect(within(card).getByText('After approval')).toBeInTheDocument();
    const create = within(card).getByRole('button', { name: 'Create link' });
    expect(create).toBeDisabled();
    expect(create).toHaveAccessibleDescription("Available after Sathiya approves your school. Teachers can't join yet.");
  });

  it('disables personal link actions with a note', () => {
    renderWithSchool(<TeachersPage />, { ctx: pending, entries });
    const links = screen.getAllByRole('button', { name: 'Personal link' });
    expect(links.length).toBeGreaterThan(0);
    for (const b of links) {
      expect(b).toBeDisabled();
      expect(b).toHaveAccessibleDescription('Personal links are available after Sathiya approves your school.');
    }
  });

  it('keeps editing teachers available', () => {
    renderWithSchool(<TeachersPage />, { ctx: pending, entries });
    expect(screen.getByRole('button', { name: '+ Add teacher' })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: 'Edit' })[0]).toBeEnabled();
  });

  it('maps a school-pending error from a personal link to the approval message', async () => {
    vi.mocked(api.createTeacherLink).mockRejectedValue(new ApiError('school-pending', 'raw'));
    const user = userEvent.setup();
    render();
    await user.click(screen.getAllByRole('button', { name: 'Personal link' })[0]!);
    expect(await screen.findByText('Available after Sathiya approves your school.')).toBeInTheDocument();
  });
});
