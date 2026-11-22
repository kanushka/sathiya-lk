// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Entry, PlanItem, SchoolContext } from '@sathiya/core';
import { C, ctx, entries6B, entry, S, T } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pickOption } from '../../test/pickOption';
import { renderWithSchool } from '../../test/renderWithSchool';
import { BlockEditor, type BlockEditorProps } from './BlockEditor';
import { TimetableApiContext, useTimetable, type TimetableApi } from './useTimetable';

const ro = vi.hoisted(() => ({ value: false }));
vi.mock('../../ui/AdminLayout', () => ({ useReadOnly: () => ro.value }));

const religion = ctx.grades.find((g) => g.number === 6)!.plan.find((p) => p.kind === 'group' && p.key === 'religion') as Extract<PlanItem, { kind: 'group' }>;

type Props = Omit<BlockEditorProps, 'entries' | 'onSave' | 'onRemove'>;

function Harness(props: Props) {
  const { entries, save, remove } = useTimetable();
  return <BlockEditor {...props} entries={entries} onSave={save} onRemove={remove} />;
}

function setup(props: Partial<Props> = {}, opts: { ctx?: SchoolContext; entries?: Entry[] } = {}) {
  const api: TimetableApi = {
    saveEntry: vi.fn().mockResolvedValue({ entryId: 'new' }),
    deleteEntry: vi.fn().mockResolvedValue({ ok: true }),
  };
  const onClose = vi.fn();
  renderWithSchool(
    <TimetableApiContext.Provider value={api}>
      <Harness open onClose={onClose} baseClassId={C.c6b} day={2} period={4} mode={{ kind: 'group', item: religion }} {...props} />
    </TimetableApiContext.Provider>,
    { ctx: opts.ctx ?? ctx, entries: opts.entries ?? entries6B },
  );
  return { api, onClose };
}

const teacherCombo = (name: RegExp) => screen.getByRole('combobox', { name });
const pick = (name: RegExp, teacher: RegExp) => pickOption(userEvent.setup(), teacherCombo(name), teacher);
const openTeachers = async (name: RegExp) => {
  await userEvent.click(teacherCombo(name));
  return within(screen.getByRole('listbox', { name }));
};

beforeEach(() => {
  ro.value = false;
});

describe('BlockEditor', () => {
  it('lists only joinable classes of the same grade and template', () => {
    setup();
    expect(screen.getByRole('button', { name: '6A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '6C' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1A' })).not.toBeInTheDocument();
  });

  it('flags a busy teacher and does not allow selecting them', async () => {
    const busy = [...entries6B, entry('x', 2, 4, [C.c6a], [[S.sinhala, T.ananda]])];
    setup({ baseClassId: C.c6b }, { entries: busy });
    const opt = (await openTeachers(/^Buddhism/)).getByRole('option', { name: /Ananda/ });
    expect(opt).toHaveAttribute('aria-disabled', 'true');
    expect(opt).toHaveTextContent('Teaching 6A · Sinhala');
  });

  it("lists only teachers of the option's subject; a subject teacher outside the grade is shown as not teaching it", async () => {
    const seniorMonk = { ...ctx.teachers.find((x) => x.id === T.ananda)!, id: 't-senior', staffId: 'SCC090', name: 'Ven. Senior Thero', grades: [12, 13] };
    setup({}, { ctx: { ...ctx, teachers: [...ctx.teachers, seniorMonk] } });
    const buddhism = await openTeachers(/^Buddhism/);
    expect(buddhism.queryByRole('option', { name: /M\. Silva/ })).not.toBeInTheDocument();
    expect(buddhism.queryByRole('option', { name: /Bandara/ })).not.toBeInTheDocument();
    expect(buddhism.getByRole('option', { name: /Ananda/ })).not.toHaveAttribute('aria-disabled');
    const senior = buddhism.getByRole('option', { name: /Senior Thero/ });
    expect(senior).toHaveAttribute('aria-disabled', 'true');
    expect(senior).toHaveTextContent("Doesn't teach Grade 6");
  });

  it('saves a group draft for two classes with a teacher per option', async () => {
    const { api, onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: '6A' }));
    await pick(/^Buddhism/, /Ananda/);
    await pick(/^Catholicism/, /M\. Silva/);
    await pick(/^Islam/, /Rizan/);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.saveEntry).toHaveBeenCalledWith({
      schoolId: ctx.school.id,
      yearId: 'y-2026',
      entry: {
        day: 2,
        period: 4,
        classIds: [C.c6b, C.c6a],
        groupKey: 'religion',
        lessons: [
          { subjectId: S.buddhism, teacherId: T.ananda },
          { subjectId: S.catholicism, teacherId: T.mSilva },
          { subjectId: S.islam, teacherId: T.rizan },
        ],
      },
    });
  });

  it('saves with a null teacher and shows the no-teacher warning', async () => {
    const { api } = setup();
    expect(screen.getAllByText('No teacher yet')).toHaveLength(3);
    await pick(/^Buddhism/, /Ananda/);
    expect(screen.getAllByText('No teacher yet')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.saveEntry).toHaveBeenCalled());
    const draft = vi.mocked(api.saveEntry).mock.calls[0]![0].entry;
    expect(draft.lessons).toEqual([
      { subjectId: S.buddhism, teacherId: T.ananda },
      { subjectId: S.catholicism, teacherId: null },
      { subjectId: S.islam, teacherId: null },
    ]);
  });

  it('builds a one-lesson multi-class combined draft without groupKey', async () => {
    const { api } = setup({ mode: { kind: 'combined', subjectId: S.maths } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '6A' }));
    await pick(/^Mathematics/, /Bandara/);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.saveEntry).toHaveBeenCalled());
    const draft = vi.mocked(api.saveEntry).mock.calls[0]![0].entry;
    expect(draft).toEqual({ day: 2, period: 4, classIds: [C.c6b, C.c6a], lessons: [{ subjectId: S.maths, teacherId: T.bandara }] });
    expect(draft).not.toHaveProperty('groupKey');
  });

  it('honours per-class plan: Buddhism a group option in 6B, a subject in 6A override', () => {
    const plan: PlanItem[] = [{ kind: 'subject', subjectId: S.buddhism, perWeek: 3 }];
    const noGroup = { ...ctx, classes: ctx.classes.map((c) => (c.id === C.c6a ? { ...c, planOverride: plan } : c)) };
    setup({}, { ctx: noGroup });
    expect(screen.queryByRole('button', { name: '6A' })).not.toBeInTheDocument();
  });

  it('combined mode offers only classes with that subject as a subject item', () => {
    const plan: PlanItem[] = [{ kind: 'subject', subjectId: S.buddhism, perWeek: 3 }];
    const c2 = { ...ctx, classes: ctx.classes.map((c) => (c.id === C.c6a ? { ...c, planOverride: plan } : c)) };
    setup({ baseClassId: C.c6b, mode: { kind: 'combined', subjectId: S.buddhism } }, { ctx: c2 });
    expect(screen.getByRole('button', { name: '6A' })).toBeInTheDocument();
  });

  it('removes an existing block', async () => {
    const existing = entries6B.find((e) => e.id === 'e-religion-2-2')!;
    const { api, onClose } = setup({ period: 2, entry: existing });
    await userEvent.click(screen.getByRole('button', { name: 'Remove block' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.deleteEntry).toHaveBeenCalledWith({ schoolId: ctx.school.id, yearId: 'y-2026', entryId: 'e-religion-2-2' });
  });

  it('hides Save and Remove when read-only', () => {
    ro.value = true;
    const existing = entries6B.find((e) => e.id === 'e-religion-2-2')!;
    setup({ period: 2, entry: existing });
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove block' })).not.toBeInTheDocument();
    expect(teacherCombo(/^Buddhism/)).toBeDisabled();
  });

  it('blocks save when one teacher is chosen for two options', async () => {
    const teachers = ctx.teachers.map((x) => (x.id === T.ananda ? { ...x, subjectIds: [...x.subjectIds, S.islam] } : x));
    setup({}, { ctx: { ...ctx, teachers } });
    await pick(/^Buddhism/, /Ananda/);
    await pick(/^Islam/, /Ananda/);
    expect(screen.getAllByText('Already chosen for another option').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('flags a limit-reached teacher but still allows saving', async () => {
    const full = Array.from({ length: 5 }, (_, i) => entry(`f${i}`, 2, i + 5, [C.c6a], [[S.buddhism, T.ananda]]));
    const { api } = setup({}, { entries: [...entries6B, ...full] });
    expect((await openTeachers(/^Buddhism/)).getByRole('option', { name: /Ananda/ })).toHaveTextContent('Limit reached · 6/6 today');
    await userEvent.keyboard('{Escape}');
    await pick(/^Buddhism/, /Ananda/);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.saveEntry).toHaveBeenCalled());
  });

  it('replaces a moved lesson: ignores it for availability and removes it after saving', async () => {
    const old = entry('old', 2, 4, [C.c12a], [[S.buddhism, T.ananda]]);
    const { api, onClose } = setup({ preset: { subjectId: S.buddhism, teacherId: T.ananda }, replacesEntryId: 'old' }, { entries: [...entries6B, old] });
    expect((await openTeachers(/^Buddhism/)).getByRole('option', { name: /Ananda/ })).not.toHaveAttribute('aria-disabled');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.saveEntry).toHaveBeenCalledWith(expect.objectContaining({ entry: expect.objectContaining({ classIds: [C.c6b], groupKey: 'religion' }) }));
    expect(api.deleteEntry).toHaveBeenCalledWith({ schoolId: ctx.school.id, yearId: 'y-2026', entryId: 'old' });
    expect(vi.mocked(api.saveEntry).mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(api.deleteEntry).mock.invocationCallOrder[0]!);
  });

  it('keeps the replaced lesson when the block save fails', async () => {
    const old = entry('old', 2, 4, [C.c12a], [[S.buddhism, T.ananda]]);
    const { api, onClose } = setup({ preset: { subjectId: S.buddhism, teacherId: T.ananda }, replacesEntryId: 'old' }, { entries: [...entries6B, old] });
    vi.mocked(api.saveEntry).mockRejectedValueOnce(new Error('boom'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.saveEntry).toHaveBeenCalled());
    expect(api.deleteEntry).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('preselects a preset teacher for its option', () => {
    setup({ preset: { subjectId: S.buddhism, teacherId: T.ananda } });
    expect(teacherCombo(/^Buddhism/)).toHaveTextContent(/Ananda/);
    expect(teacherCombo(/^Catholicism/)).toHaveTextContent('Choose a teacher');
  });

  it('renders nothing actionable when the slot is not in the class template', () => {
    setup({ baseClassId: C.c6c, day: 4, period: 8 });
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});
