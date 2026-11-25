// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { startOverDeletes, type SolveResult } from '@sathiya/core';
import { C, ctx, entries6B, G, S, T } from '@sathiya/core/fixtures';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pickOption } from '../../test/pickOption';
import { renderWithSchool } from '../../test/renderWithSchool';
import { ClassViewPage } from '../timetable/ClassViewPage';
import { TeacherViewPage } from '../timetable/TeacherViewPage';
import { TimetableApiContext, type TimetableApi } from '../timetable/useTimetable';
import { AutoFillPage } from './AutoFillPage';
import { SolverWorkerContext, type SolverMessage, type SolverRequest, type SolverWorker } from './useSolver';

const mocked = vi.hoisted(() => ({ result: null as null | { blocking: unknown[]; warnings: unknown[] } }));
vi.mock('@sathiya/core', async (orig) => {
  const actual = await orig<typeof import('@sathiya/core')>();
  return { ...actual, readiness: (...a: Parameters<typeof actual.readiness>) => mocked.result ?? actual.readiness(...a) };
});

const ro = vi.hoisted(() => ({ value: false }));
vi.mock('../../ui/AdminLayout', () => ({ useReadOnly: () => ro.value }));

class FakeWorker implements SolverWorker {
  posted: SolverRequest[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<SolverMessage>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage(m: SolverRequest) {
    this.posted.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  emit(m: SolverMessage) {
    act(() => this.onmessage?.({ data: m } as MessageEvent<SolverMessage>));
  }
}

let workers: FakeWorker[] = [];
let api: TimetableApi;

beforeEach(() => {
  mocked.result = null;
  ro.value = false;
  sessionStorage.clear();
  workers = [];
  api = { saveEntry: vi.fn(), deleteEntry: vi.fn(), applyAutoFill: vi.fn(async () => ({ written: 2, deleted: entries6B.length })) };
});

const factory = () => {
  const w = new FakeWorker();
  workers.push(w);
  return w;
};

function setup(context = ctx, route = '/s/siripura/admin/timetable/auto-fill') {
  renderWithSchool(
    <TimetableApiContext.Provider value={api}>
      <SolverWorkerContext.Provider value={factory}>
        <Routes>
          <Route path="/s/siripura/admin/timetable/auto-fill" element={<AutoFillPage />} />
          <Route path="/s/siripura/admin/timetable/class" element={<p>class index</p>} />
          <Route path="/s/siripura/admin/timetable/class/:classId" element={<ClassViewPage />} />
          <Route path="/s/siripura/admin/timetable/teacher/:teacherId" element={<TeacherViewPage />} />
        </Routes>
      </SolverWorkerContext.Provider>
    </TimetableApiContext.Provider>,
    { ctx: context, entries: entries6B, route },
  );
}

describe('AutoFillPage', () => {
  it('shows blocking issues with links and disables Continue', () => {
    setup({ ...ctx, classes: ctx.classes.map((c) => (c.id === C.c6b ? { ...c, classTeacherId: undefined } : c)) });
    const group = screen.getByRole('heading', { name: 'Grades & classes' }).closest('section')!;
    const item = within(group).getAllByRole('listitem').find((li) => /6B/.test(li.textContent ?? ''))!;
    expect(item).toHaveTextContent(/has no class teacher/);
    expect(within(item).getByRole('link')).toHaveAttribute('href', '/s/siripura/admin/grades');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.queryByText('Ready to generate')).not.toBeInTheDocument();
  });

  it('groups the same missing teacher across classes into one line', () => {
    const issue = (classId: string) => ({ code: 'no-qualified-teacher', ref: { kind: 'class', id: classId }, params: { classId, subjectId: S.geography, grade: 6 } });
    mocked.result = { blocking: [issue(C.c6a), issue(C.c6b), issue(C.c6c)], warnings: [] };
    setup();
    const items = within(screen.getByRole('heading', { name: 'Teachers' }).closest('section')!).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('No teacher with Grade 6 in their grades teaches Geography (6A, 6B, 6C).');
    expect(within(items[0]!).getByRole('link')).toHaveAttribute('href', '/s/siripura/admin/teachers');
  });

  it('groups the unbuildable days of one class item into one line', () => {
    const issue = (day: number) => ({ code: 'per-day-unbuildable', ref: { kind: 'class', id: C.c6a }, params: { classId: C.c6a, planKey: `subject:${S.maths}`, day, minutes: 10 } });
    mocked.result = { blocking: [issue(0), issue(1)], warnings: [] };
    setup();
    const items = within(screen.getByRole('heading', { name: 'Templates' }).closest('section')!).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/Monday, Tuesday/);
  });

  it('shows the ready state with warnings and an enabled Continue', () => {
    mocked.result = { blocking: [], warnings: [{ code: 'capacity-short', ref: { kind: 'subject', id: S.maths }, params: { subjectId: S.maths, needed: 30, capacity: 20 } }] };
    setup();
    expect(screen.getByRole('heading', { name: 'Ready to generate' })).toBeInTheDocument();
    expect(screen.getByText(/Mathematics/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('shows the ready state with nothing to fix', () => {
    mocked.result = { blocking: [], warnings: [] };
    setup();
    expect(screen.getByRole('heading', { name: 'Ready to generate' })).toBeInTheDocument();
  });
});

const draft = { day: 2 as const, period: 4, classIds: [C.c6b], lessons: [{ subjectId: S.maths, teacherId: T.perera }] };

function resultFor(req: SolverRequest, seed = req.seed): SolveResult {
  return {
    allocation: [{ classId: C.c6b, planKey: `subject:${S.maths}`, subjectId: S.maths, teacherId: T.perera }],
    drafts: [draft],
    deleteEntryIds: req.mode.kind === 'startOver' ? startOverDeletes(req.ctx, req.entries, req.mode.gradeIds) : [],
    unplaced: [],
    soft: { samePattern: 1, splitDoubles: 0, minPerWeekShort: [], stacked: 0 },
    seed,
    attempts: 1,
  };
}

describe('AutoFillPage flow', () => {
  beforeEach(() => {
    mocked.result = { blocking: [], warnings: [] };
  });

  it('fill around runs the solver with progress and cancel', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('radio', { name: /Fill around/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Generate timetable' }));
    expect(workers).toHaveLength(1);
    const req = workers[0]!.posted[0]!;
    expect(req.mode).toEqual({ kind: 'fillAround' });
    expect(req.entries).toEqual(entries6B);
    expect(Object.keys(req.ctx).sort()).toEqual(['classes', 'grades', 'school', 'subjects', 'teachers', 'templates']);
    workers[0]!.emit({ type: 'progress', attempt: 3, best: [4, 0, 0, 0, 0] });
    expect(screen.getByText('Attempt 3')).toBeInTheDocument();
    expect(screen.getByText(/Best so far: 4 periods not placed/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(workers[0]!.terminated).toBe(true);
    expect(screen.getByRole('button', { name: 'Generate timetable' })).toBeInTheDocument();
  });

  it('Save with deleteEntryIds in start-over mode', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('radio', { name: /Start over/ }));
    expect(screen.getByRole('button', { name: 'Generate timetable' })).toBeDisabled();
    await pickOption(user, screen.getByRole('combobox', { name: 'Grades to start over' }), 'Grade 6');
    const n = startOverDeletes(ctx, entries6B, [G.g6]).length;
    expect(screen.getByText(`${n} hand-placed slots in these grades will be replaced.`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate timetable' }));
    const req = workers[0]!.posted[0]!;
    expect(req.mode).toEqual({ kind: 'startOver', gradeIds: [G.g6] });
    workers[0]!.emit({ type: 'done', result: resultFor(req) });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.applyAutoFill).toHaveBeenCalledWith({ schoolId: 'siripura', yearId: 'y-2026', deleteEntryIds: entries6B.map((e) => e.id), drafts: [draft] });
    expect(await screen.findByText('class index')).toBeInTheDocument();
    expect(screen.getByText('Auto-fill saved 2 lessons.')).toBeInTheDocument();
  });

  it('re-runs placement with the edited allocation and tries again with a new seed', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Generate timetable' }));
    const first = workers[0]!.posted[0]!;
    workers[0]!.emit({ type: 'done', result: resultFor(first) });
    await pickOption(user, screen.getByRole('combobox', { name: /^Teacher for Mathematics in 6B/ }), /Bandara/);
    await user.click(screen.getByRole('button', { name: 'Re-run placement' }));
    const second = workers[1]!.posted[0]!;
    expect(second.seed).toBe(first.seed);
    expect(second.overrides).toEqual([{ classId: C.c6b, planKey: `subject:${S.maths}`, subjectId: S.maths, teacherId: T.bandara }]);
    workers[1]!.emit({ type: 'done', result: resultFor(second) });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    const third = workers[2]!.posted[0]!;
    expect(third.seed).not.toBe(first.seed);
    expect(third.overrides).toEqual(second.overrides);
  });

  it('shows a solver error with a way back', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Generate timetable' }));
    workers[0]!.emit({ type: 'error', message: 'boom' });
    expect(screen.getByText(/boom/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to options' }));
    expect(screen.getByRole('button', { name: 'Generate timetable' })).toBeInTheDocument();
  });
});

describe('Auto-fill button', () => {
  it('opens the readiness screen from the class view', async () => {
    mocked.result = { blocking: [], warnings: [] };
    setup(ctx, `/s/siripura/admin/timetable/class/${C.c6b}`);
    await userEvent.click(screen.getByRole('link', { name: 'Auto-fill' }));
    expect(await screen.findByRole('heading', { name: 'Ready to generate' })).toBeInTheDocument();
  });

  it('is on the teacher view and hidden for read-only years', () => {
    setup(ctx, '/s/siripura/admin/timetable/teacher/' + ctx.teachers[0]!.id);
    expect(screen.getByRole('link', { name: 'Auto-fill' })).toBeInTheDocument();
  });

  it('is hidden when read-only', () => {
    ro.value = true;
    setup(ctx, `/s/siripura/admin/timetable/class/${C.c6b}`);
    expect(screen.queryByRole('link', { name: 'Auto-fill' })).not.toBeInTheDocument();
  });
});
