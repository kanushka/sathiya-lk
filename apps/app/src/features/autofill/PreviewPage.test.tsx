// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { EntryDraft, SchoolContext, SolveResult } from '@sathiya/core';
import { C, ctx, entries6B, G, S, T } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/callable';
import { pickOption } from '../../test/pickOption';
import { renderWithSchool } from '../../test/renderWithSchool';
import { TimetableApiContext, type TimetableApi } from '../timetable/useTimetable';
import { PreviewPage } from './PreviewPage';

const ro = vi.hoisted(() => ({ value: false }));
vi.mock('../../ui/AdminLayout', () => ({ useReadOnly: () => ro.value }));

beforeEach(() => {
  ro.value = false;
});

const draft: EntryDraft = { day: 2, period: 4, classIds: [C.c6b], lessons: [{ subjectId: S.maths, teacherId: T.perera }] };

const result: SolveResult = {
  allocation: [
    { classId: C.c6b, planKey: `subject:${S.maths}`, subjectId: S.maths, teacherId: T.perera },
    { classId: C.c6b, planKey: `subject:${S.geography}`, subjectId: S.geography, teacherId: T.herath },
  ],
  drafts: [draft],
  deleteEntryIds: ['e-6b-0-1'],
  unplaced: [{ classId: C.c6b, planKey: `subject:${S.geography}`, missing: 1, unit: 'periods', reason: 'teacher-at-limit', params: { subjectId: S.geography, day: 3, teacherId: T.herath } }],
  soft: { samePattern: 0.916, splitDoubles: 0, minPerWeekShort: [], stacked: 0 },
  seed: 42,
  attempts: 5,
};

function makeApi(apply: TimetableApi['applyAutoFill'] = vi.fn(async () => ({ written: 1, deleted: 1 }))): TimetableApi {
  return { saveEntry: vi.fn(), deleteEntry: vi.fn(), applyAutoFill: apply };
}

function setup(api = makeApi(), res: SolveResult = result, context: SchoolContext = ctx) {
  const onRerun = vi.fn();
  const onTryAgain = vi.fn();
  const onDiscard = vi.fn();
  const onFillAround = vi.fn();
  const view = renderWithSchool(
    <TimetableApiContext.Provider value={api}>
      <Routes>
        <Route
          path="/s/siripura/admin/timetable/auto-fill"
          element={<PreviewPage result={res} entries={entries6B} onRerun={onRerun} onTryAgain={onTryAgain} onDiscard={onDiscard} onFillAround={onFillAround} />}
        />
        <Route path="/s/siripura/admin/timetable/class" element={<p>class view</p>} />
      </Routes>
    </TimetableApiContext.Provider>,
    { ctx: context, entries: entries6B, route: '/s/siripura/admin/timetable/auto-fill' },
  );
  return { api, onRerun, onTryAgain, onDiscard, onFillAround, unmount: view.unmount };
}

describe('PreviewPage', () => {
  it('shows the summary', () => {
    setup();
    expect(screen.getByText('92% of subjects in the same slot all week')).toBeInTheDocument();
    expect(screen.getByText(/1 item not fully placed/)).toBeInTheDocument();
    expect(screen.getByText('Grade 6')).toBeInTheDocument();
    expect(screen.getByText(/Try 42/)).toBeInTheDocument();
  });

  it('editing allocation marks stale', async () => {
    const user = userEvent.setup();
    const { onRerun } = setup();
    expect(screen.queryByRole('button', { name: 'Re-run placement' })).not.toBeInTheDocument();
    await pickOption(user, screen.getByRole('combobox', { name: /^Teacher for Mathematics in 6B/ }), /Bandara/);
    expect(screen.getByText(/Re-run placement to see/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Re-run placement' }));
    expect(onRerun).toHaveBeenCalledWith([{ classId: C.c6b, planKey: `subject:${S.maths}`, subjectId: S.maths, teacherId: T.bandara }]);
  });

  it('Try again asks for a new seed', async () => {
    const { onTryAgain } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onTryAgain).toHaveBeenCalledWith([]);
  });

  it('Try again passes pending allocation edits', async () => {
    const user = userEvent.setup();
    const { onTryAgain } = setup();
    await pickOption(user, screen.getByRole('combobox', { name: /^Teacher for Mathematics in 6B/ }), /Bandara/);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onTryAgain).toHaveBeenCalledWith([{ classId: C.c6b, planKey: `subject:${S.maths}`, subjectId: S.maths, teacherId: T.bandara }]);
  });

  it('hides Save when read-only', () => {
    ro.value = true;
    setup();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('highlights new entries in the class grid', async () => {
    setup();
    await userEvent.click(screen.getByRole('tab', { name: 'Classes' }));
    expect(screen.getByRole('button', { name: /^New: Maths/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Wednesday/ }).filter((b) => /^New/.test(b.getAttribute('aria-label') ?? ''))).toHaveLength(1);
  });

  it('explains unplaced items with a fix link', async () => {
    setup();
    await userEvent.click(screen.getByRole('tab', { name: /Unplaced/ }));
    const item = within(screen.getByRole('tabpanel')).getByRole('listitem');
    expect(item).toHaveTextContent('6B · Geography: 1 period not placed.');
    expect(item).toHaveTextContent(/K\. Herath reaches the daily limit on Thursday/);
    expect(within(item).getByRole('link')).toHaveAttribute('href', '/s/siripura/admin/teachers');
    expect(within(item).getByRole('link')).toHaveAttribute('target', '_blank');
    expect(within(item).getByRole('link')).toHaveAttribute('rel', 'noopener');
  });

  it('Save calls applyAutoFill with drafts and deleteEntryIds', async () => {
    const { api } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.applyAutoFill).toHaveBeenCalledWith({ schoolId: 'siripura', yearId: 'y-2026', deleteEntryIds: ['e-6b-0-1'], drafts: [draft] });
    expect(await screen.findByText('class view')).toBeInTheDocument();
    expect(screen.getByText('Auto-fill saved 1 lesson.')).toBeInTheDocument();
  });

  it('offers a re-run when the timetable changed', async () => {
    const { onRerun } = setup(makeApi(vi.fn(async () => Promise.reject(new ApiError('clash', 'clash', { conflicts: [] })))));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/The timetable changed since you generated this/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Run again' }));
    expect(onRerun).toHaveBeenCalledWith([]);
  });

  it('shows the busy message', async () => {
    setup(makeApi(vi.fn(async () => Promise.reject(new ApiError('busy', 'busy')))));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Someone else is saving/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('lists teachers short of their weekly minimum', () => {
    setup(makeApi(), { ...result, soft: { ...result.soft, minPerWeekShort: [{ teacherId: T.herath, short: 3 }] } });
    expect(screen.getByText('Mr. K. Herath: 3 lessons short of their weekly minimum')).toBeInTheDocument();
  });

  it('explains allocation problems in the unplaced list', async () => {
    const unplaced: SolveResult['unplaced'] = [
      { classId: C.c6b, planKey: `subject:${S.geography}`, missing: 2, unit: 'periods', reason: 'subject-cap', params: { subjectId: S.geography, teacherId: T.herath } },
      { classId: C.c6b, planKey: `subject:${S.history}`, missing: 2, unit: 'periods', reason: 'subject-cap', params: {} },
      { classId: C.c6b, planKey: 'group:religion', missing: 2, unit: 'periods', reason: 'duplicate-option-teacher', params: {} },
      { classId: C.c6b, planKey: 'class-teacher', missing: 0, unit: 'periods', reason: 'class-teacher-no-daily-subject', params: { teacherId: T.perera } },
    ];
    setup(makeApi(), { ...result, unplaced });
    await userEvent.click(screen.getByRole('tab', { name: /Unplaced/ }));
    const items = within(screen.getByRole('tabpanel')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Mr. K. Herath would teach more than two subjects in this class.');
    expect(items[1]).toHaveTextContent('Every teacher who can take it already teaches two subjects in this class.');
    expect(items[2]).toHaveTextContent('Two options of the block have the same teacher.');
    expect(items[3]).toHaveTextContent('6B: Mrs. N. Perera, the class teacher, has no subject here with a lesson every day, so cannot take the first period.');
    expect(items[3]).not.toHaveTextContent('not placed');
  });

  it('offers a re-run when an entry to replace is gone', async () => {
    const { onRerun } = setup(makeApi(vi.fn(async () => Promise.reject(new ApiError('clash', 'gone', { stale: true })))));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Run again' }));
    expect(onRerun).toHaveBeenCalledWith([]);
  });

  it('after a partial save, blocks Save and offers fill-around', async () => {
    const { onFillAround } = setup(makeApi(vi.fn(async () => Promise.reject(new ApiError('invalid', 'part-way', { written: 2, deleted: 1 })))));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Saving stopped part-way/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Back to options' }));
    expect(onFillAround).toHaveBeenCalled();
  });

  it('refuses to save more lessons than one save allows', async () => {
    const { api } = setup(makeApi(), { ...result, drafts: Array.from({ length: 3001 }, () => draft) });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Too many lessons to save at once/)).toBeInTheDocument();
    expect(api.applyAutoFill).not.toHaveBeenCalled();
  });

  it('keeps one teacher to one option of a group block', async () => {
    const user = userEvent.setup();
    const both: SchoolContext = { ...ctx, teachers: ctx.teachers.map((x) => (x.id === T.ananda ? { ...x, subjectIds: [S.buddhism, S.catholicism] } : x)) };
    const allocation: SolveResult['allocation'] = [
      { classId: C.c6b, planKey: 'group:religion', subjectId: S.buddhism, teacherId: T.ananda },
      { classId: C.c6b, planKey: 'group:religion', subjectId: S.catholicism, teacherId: T.mSilva },
    ];
    setup(makeApi(), { ...result, allocation }, both);
    await user.click(screen.getByRole('combobox', { name: /^Teacher for Religion · Catholicism in 6B/ }));
    expect(screen.queryByRole('option', { name: /Ananda/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /M\. Silva/ })).toBeInTheDocument();
  });

  it('offers teachers by the grade staffing mode', async () => {
    const user = userEvent.setup();
    const withMode = (staffing: NonNullable<SchoolContext['grades'][number]['staffing']>): SchoolContext => ({
      ...ctx,
      grades: ctx.grades.map((g) => (g.id === G.g6 ? { ...g, staffing } : g)),
    });
    const allocation: SolveResult['allocation'] = [
      { classId: C.c6b, planKey: `subject:${S.maths}`, subjectId: S.maths, teacherId: T.bandara },
      { classId: C.c6b, planKey: `subject:${S.geography}`, subjectId: S.geography, teacherId: T.perera },
    ];
    const optionsFor = async (subject: string): Promise<string[]> => {
      await user.click(screen.getByRole('combobox', { name: new RegExp(`^Teacher for ${subject} in 6B`) }));
      const names = screen.getAllByRole('option').map((o) => o.textContent ?? '');
      await user.keyboard('{Escape}');
      return names;
    };

    const view = setup(makeApi(), { ...result, allocation }, withMode({ mode: 'classTeacherPlusSpecialists', specialistSubjectIds: [S.maths] }));
    expect(await optionsFor('Mathematics')).toEqual(['Mr. P. Bandara']);
    expect(await optionsFor('Geography')).toEqual(['Mrs. N. Perera']);
    view.unmount();

    setup(makeApi(), { ...result, allocation }, withMode({ mode: 'classTeacherAll' }));
    expect(await optionsFor('Geography')).toEqual(['Mrs. N. Perera']);
  });
});
