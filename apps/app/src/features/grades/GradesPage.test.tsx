// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { C, ctx, entries, G, mahasen, S } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pickOption } from '../../test/pickOption';
import { call } from '../../lib/callable';
import { renderWithSchool } from '../../test/renderWithSchool';
import * as api from './api';
import { GradesPage } from './GradesPage';

const flags = vi.hoisted(() => ({ readOnly: false }));

vi.mock('./api');
vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));
vi.mock('../../ui/AdminLayout', async (orig) => ({ ...(await orig<typeof import('../../ui/AdminLayout')>()), useReadOnly: () => flags.readOnly }));

beforeEach(() => {
  vi.resetAllMocks();
  flags.readOnly = false;
});

const grade6 = ctx.grades.find((g) => g.id === G.g6)!;

async function openGrade6() {
  const user = userEvent.setup();
  renderWithSchool(<GradesPage />, { ctx, entries });
  await user.click(screen.getByRole('button', { name: /^Grade 6\b/ }));
  return user;
}

const headerActions = () => within(screen.getByTestId('page-header')).getAllByRole('button').map((b) => b.textContent);

describe('grades page', () => {
  it('grade 1 plan is measured against its classes\' Primary template', async () => {
    const user = userEvent.setup();
    renderWithSchool(<GradesPage />, { ctx, entries });
    await user.click(screen.getByRole('button', { name: /^Grade 1\b/ }));
    const total = screen.getByTestId('plan-total');
    expect(total).toHaveTextContent('30 / 30');
    expect(total).toHaveAttribute('data-fit', 'exact');
  });

  it('under-filled plan is not shown as complete', async () => {
    const user = userEvent.setup();
    const g1 = ctx.grades.find((g) => g.id === G.g1)!;
    const short = { ...ctx, grades: ctx.grades.map((g) => (g.id === G.g1 ? { ...g, plan: g1.plan.slice(1) } : g)) };
    renderWithSchool(<GradesPage />, { ctx: short, entries });
    await user.click(screen.getByRole('button', { name: /^Grade 1\b/ }));
    expect(screen.getByTestId('plan-total')).toHaveAttribute('data-fit', 'under');
  });

  it('grade 6 shows the range of its classes\' templates', async () => {
    await openGrade6();
    const total = screen.getByTestId('plan-total');
    expect(total).toHaveTextContent('40 / 39–40');
    expect(total).toHaveAttribute('data-fit', 'mixed');
  });

  it('a grade without classes uses the default template', async () => {
    const user = userEvent.setup();
    renderWithSchool(<GradesPage />, { ctx: { ...ctx, classes: ctx.classes.filter((c) => c.gradeId !== G.g1) }, entries });
    await user.click(screen.getByRole('button', { name: /^Grade 1\b/ }));
    expect(screen.getByTestId('plan-total')).toHaveTextContent('30 / 40');
  });

  it('group option remove and add', async () => {
    const user = await openGrade6();
    await user.click(screen.getByRole('button', { name: 'Remove Music from Aesthetic' }));
    const afterRemove = vi.mocked(api.saveGradePlan).mock.calls[0]![2];
    const aesthetic = afterRemove.find((p) => p.kind === 'group' && p.key === 'aesthetic');
    expect(aesthetic).toMatchObject({ optionSubjectIds: [S.dancing, S.art] });
    expect(vi.mocked(api.saveGradePlan).mock.calls[0]![1]).toBe(G.g6);

    await pickOption(user, screen.getByRole('combobox', { name: /^Add option to Aesthetic/ }), 'Pali');
    const afterAdd = vi.mocked(api.saveGradePlan).mock.calls[1]![2];
    expect(afterAdd.find((p) => p.kind === 'group' && p.key === 'aesthetic')).toMatchObject({
      optionSubjectIds: [S.music, S.dancing, S.art, S.pali],
    });
  });

  it('custom plan saved on class', async () => {
    const user = await openGrade6();
    const card = screen.getByText('6A').closest('[data-testid="class-card"]') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Custom plan' }));
    const dialog = screen.getByRole('dialog');
    const maths = within(dialog).getByLabelText('Periods per week for Mathematics');
    expect(maths).toHaveValue(6);
    await user.clear(maths);
    await user.type(maths, '5');
    await user.click(within(dialog).getByRole('button', { name: 'Save custom plan' }));
    const [sid, cid, plan] = vi.mocked(api.setPlanOverride).mock.calls[0]!;
    expect([sid, cid]).toEqual(['siripura', C.c6a]);
    expect(plan).toHaveLength(grade6.plan.length);
    expect(plan![0]).toMatchObject({ kind: 'subject', subjectId: S.maths, perWeek: 5 });
  });

  it('use grade plan clears the override', async () => {
    const user = userEvent.setup();
    renderWithSchool(<GradesPage />, { ctx, entries });
    await user.click(screen.getByRole('button', { name: /^Grade 12\b/ }));
    await user.click(screen.getByRole('button', { name: 'Custom plan' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Use grade plan' }));
    expect(api.setPlanOverride).toHaveBeenCalledWith('siripura', C.c12a, null);
  });

  it('add class names 6D', async () => {
    const user = await openGrade6();
    await user.click(screen.getByRole('button', { name: '+ Add class 6D' }));
    expect(api.addClass).toHaveBeenCalledWith('siripura', { gradeId: G.g6, name: '6D', templateId: 'tpl-default' });
  });

  it('typing a per-week count writes once, on blur, and reverts when cleared', async () => {
    const user = await openGrade6();
    const maths = screen.getByLabelText('Periods per week for Mathematics');
    await user.clear(maths);
    await user.type(maths, '12');
    expect(api.saveGradePlan).not.toHaveBeenCalled();
    await user.tab();
    expect(api.saveGradePlan).toHaveBeenCalledTimes(1);
    const plan = vi.mocked(api.saveGradePlan).mock.calls[0]![2];
    expect(plan.find((p) => p.kind === 'subject' && p.subjectId === S.maths)).toMatchObject({ perWeek: 12 });

    vi.mocked(api.saveGradePlan).mockClear();
    const english = screen.getByLabelText('Periods per week for English');
    await user.clear(english);
    await user.tab();
    expect(api.saveGradePlan).not.toHaveBeenCalled();
    expect(english).toHaveValue(Number((grade6.plan.find((p) => p.kind === 'subject' && p.subjectId === S.english) as { perWeek: number }).perWeek));
  });

  it('read-only lists every option subject of a group in stored order, with no picker', async () => {
    flags.readOnly = true;
    const ids = [S.music, S.dancing, S.art, S.pali, S.tamil, 's-gone'];
    const wide = {
      ...ctx,
      grades: ctx.grades.map((g) =>
        g.id === G.g6 ? { ...g, plan: g.plan.map((p) => (p.kind === 'group' && p.key === 'aesthetic' ? { ...p, optionSubjectIds: ids } : p)) } : g,
      ),
    };
    const user = userEvent.setup();
    renderWithSchool(<GradesPage />, { ctx: wide, entries });
    await user.click(screen.getByRole('button', { name: /^Grade 6\b/ }));
    expect(screen.queryByRole('combobox', { name: /Add option/ })).toBeNull();
    const chips = screen.getAllByText(/^(Music|Dancing|Art|Pali|Tamil \(2nd language\)|s-gone)$/, { selector: 'span.truncate' });
    expect(chips.map((c) => c.textContent)).toEqual(['Music', 'Dancing', 'Art', 'Pali', 'Tamil (2nd language)', 's-gone']);
  });

  it('shows all option chips and keeps unknown subject ids removable when editable', async () => {
    const ids = [S.music, S.dancing, S.art, S.pali, 's-gone'];
    const wide = {
      ...ctx,
      grades: ctx.grades.map((g) =>
        g.id === G.g6 ? { ...g, plan: g.plan.map((p) => (p.kind === 'group' && p.key === 'aesthetic' ? { ...p, optionSubjectIds: ids } : p)) } : g,
      ),
    };
    const user = userEvent.setup();
    renderWithSchool(<GradesPage />, { ctx: wide, entries });
    await user.click(screen.getByRole('button', { name: /^Grade 6\b/ }));
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Remove s-gone from Aesthetic' }));
    const saved = vi.mocked(api.saveGradePlan).mock.calls[0]![2];
    expect(saved.find((p) => p.kind === 'group' && p.key === 'aesthetic')).toMatchObject({ optionSubjectIds: [S.music, S.dancing, S.art, S.pali] });
  });

  it('has the page title and a primary + Add grade at the top right', async () => {
    await openGrade6();
    expect(screen.getByRole('heading', { level: 1, name: 'Grades & classes' })).toBeInTheDocument();
    expect(headerActions().at(-1)).toBe('+ Add grade');
    expect(screen.getByRole('heading', { level: 2, name: 'Grade 6 settings' })).toBeInTheDocument();
  });

  it('deletes a grade through the server after confirming, naming its classes', async () => {
    vi.mocked(call).mockResolvedValue({ deleted: true, usedIn: 0 });
    const user = await openGrade6();
    await user.click(screen.getByRole('button', { name: 'Delete grade' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Grade 6?' });
    const names = ctx.classes.filter((c) => c.gradeId === G.g6).map((c) => c.name).sort().join(', ');
    expect(within(dialog).getByText(new RegExp(names))).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(call).toHaveBeenCalledWith('deleteSetupItem', { schoolId: 'siripura', kind: 'grade', id: G.g6 });
    expect(await screen.findByText('Grade 6 deleted')).toBeInTheDocument();
  });

  it('shows the slot count when the grade is in use', async () => {
    vi.mocked(call).mockResolvedValue({ deleted: false, usedIn: 4 });
    const user = await openGrade6();
    await user.click(screen.getByRole('button', { name: 'Delete grade' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText(/used in 4 slots/)).toBeInTheDocument();
  });

  it('links to Subjects and Period templates when they are missing', async () => {
    const user = userEvent.setup();
    renderWithSchool(<GradesPage />, { ctx: { ...ctx, subjects: [], templates: [] }, entries: [] });
    await user.click(screen.getByRole('button', { name: /^Grade 6\b/ }));
    expect(screen.getByRole('link', { name: 'Go to subjects' })).toHaveAttribute('href', '/admin/subjects');
    expect(screen.getByRole('link', { name: 'Go to period templates' })).toHaveAttribute('href', '/admin/templates');
  });

  it('read-only hides every write control', async () => {
    flags.readOnly = true;
    const user = await openGrade6();
    expect(screen.queryByRole('button', { name: /Add class/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add grade/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete grade' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add subject|Add group/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Custom plan' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /^Add option to Aesthetic/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove .* from Aesthetic/ })).toBeNull();
    ['Music', 'Dancing', 'Art'].forEach((n) => expect(screen.getByText(n, { selector: 'span.truncate' })).toBeInTheDocument());
    expect(screen.getByLabelText('Periods per week for Mathematics')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Grade 1\b/ }));
    expect(api.saveGradePlan).not.toHaveBeenCalled();
  });

  it('toggling a row to time waits for a value above zero before saving', async () => {
    const user = await openGrade6();
    await user.click(screen.getByRole('button', { name: 'Time for Mathematics' }));
    expect(api.saveGradePlan).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Minutes per week for Mathematics')).toHaveValue(null);
    await user.type(screen.getByLabelText('Minutes per week for Mathematics'), '0');
    await user.tab();
    expect(api.saveGradePlan).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Minutes per week for Mathematics'), '50');
    await user.tab();
    const plan = vi.mocked(api.saveGradePlan).mock.calls.at(-1)![2];
    expect(plan.find((p) => p.kind === 'subject' && p.subjectId === S.maths)).toMatchObject({ unit: 'minutes', perWeek: 50 });
  });

  it('shows the specific message and skips the save for an invalid plan', async () => {
    const user = userEvent.setup();
    const bad = {
      ...ctx,
      grades: ctx.grades.map((g) => (g.id === G.g6 ? { ...g, plan: g.plan.map((p, i) => (i === 0 ? { ...p, unit: 'minutes' as const, perWeek: 55, perDay: 10 } : p)) } : g)),
    };
    renderWithSchool(<GradesPage />, { ctx: bad, entries });
    await user.click(screen.getByRole('button', { name: /^Grade 6\b/ }));
    const english = screen.getByLabelText('Periods per week for English');
    await user.clear(english);
    await user.type(english, '4');
    await user.tab();
    expect(api.saveGradePlan).not.toHaveBeenCalled();
    expect(await screen.findByText('Minutes per week must equal minutes per day × 5.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Custom plan' })[0]!);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save custom plan' }));
    expect(api.setPlanOverride).not.toHaveBeenCalled();
  });

  describe('with a time-based row', () => {
    const timed = {
      ...ctx,
      grades: ctx.grades.map((g) => (g.id === G.g6 ? { ...g, plan: g.plan.map((p) => (p.kind === 'subject' && p.subjectId === S.maths ? { ...p, perWeek: 50, unit: 'minutes' as const } : p)) } : g)),
    };

    async function openTimed() {
      const user = userEvent.setup();
      renderWithSchool(<GradesPage />, { ctx: timed, entries });
      await user.click(screen.getByRole('button', { name: /^Grade 6\b/ }));
      return user;
    }

    it('stores hours and minutes as total minutes', async () => {
      const user = await openTimed();
      expect(screen.getByLabelText('Hours per week for Mathematics')).toHaveValue(0);
      expect(screen.getByLabelText('Minutes per week for Mathematics')).toHaveValue(50);
      const hours = screen.getByLabelText('Hours per week for Mathematics');
      await user.clear(hours);
      await user.type(hours, '3');
      await user.tab();
      const plan = vi.mocked(api.saveGradePlan).mock.calls.at(-1)![2];
      expect(plan.find((p) => p.kind === 'subject' && p.subjectId === S.maths)).toMatchObject({ unit: 'minutes', perWeek: 230 });
    });

    it('per-day minutes set the weekly total to five days', async () => {
      const user = await openTimed();
      await user.type(screen.getByLabelText('Minutes per day for Mathematics'), '10');
      await user.tab();
      const plan = vi.mocked(api.saveGradePlan).mock.calls.at(-1)![2];
      expect(plan.find((p) => p.kind === 'subject' && p.subjectId === S.maths)).toMatchObject({ unit: 'minutes', perWeek: 50, perDay: 10 });
    });

    it('derives the weekly inputs from per-day minutes', async () => {
      const withDay = { ...timed, grades: timed.grades.map((g) => ({ ...g, plan: g.plan.map((p) => (p.kind === 'subject' && p.subjectId === S.maths ? { ...p, perDay: 10 } : p)) })) };
      renderWithSchool(<GradesPage />, { ctx: withDay, entries });
      await userEvent.click(screen.getByRole('button', { name: /^Grade 6\b/ }));
      expect(screen.getByLabelText('Hours per week for Mathematics')).toBeDisabled();
      expect(screen.getByLabelText('Minutes per week for Mathematics')).toBeDisabled();
      expect(screen.getByLabelText('Minutes per day for Mathematics')).toHaveValue(10);
    });

    it('keeps time rows out of the period total', async () => {
      await openTimed();
      expect(screen.getByTestId('plan-total')).toHaveTextContent('34 / 39–40');
    });
  });

  it('hides the period fit for an all-timed plan', async () => {
    renderWithSchool(<GradesPage />, { ctx: mahasen.ctx, entries: [] });
    await userEvent.click(screen.getByRole('button', { name: /^Grade 1\b/ }));
    expect(screen.queryByTestId('plan-total')).not.toBeInTheDocument();
    expect(screen.getByTestId('plan-timed')).toHaveTextContent('17h 30m timed per week');
  });

  it('shows the default staffing for the grade and saves a change', async () => {
    const user = await openGrade6();
    const mode = screen.getByRole('combobox', { name: /^Staffing/ });
    expect(mode).toHaveTextContent('Subject teachers');
    await pickOption(user, mode, 'Class teacher plus specialist teachers');
    expect(api.saveGradeStaffing).toHaveBeenCalledWith('siripura', G.g6, { mode: 'classTeacherPlusSpecialists', specialistSubjectIds: [S.english] });
  });

  it('offers specialist subjects only for class teacher plus specialists', async () => {
    const user = userEvent.setup();
    renderWithSchool(<GradesPage />, { ctx, entries });
    expect(screen.getByRole('combobox', { name: /^Staffing/ })).toHaveTextContent('Class teacher teaches everything');
    expect(screen.queryByRole('combobox', { name: /Specialist subjects/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Grade 6\b/ }));
    expect(screen.queryByRole('combobox', { name: /Specialist subjects/ })).not.toBeInTheDocument();
  });

  it('shows the specialist subjects for a grade set to class teacher plus specialists', async () => {
    const user = userEvent.setup();
    const set = { ...ctx, grades: ctx.grades.map((g) => (g.id === G.g6 ? { ...g, staffing: { mode: 'classTeacherPlusSpecialists' as const, specialistSubjectIds: [S.english] } } : g)) };
    renderWithSchool(<GradesPage />, { ctx: set, entries });
    await user.click(screen.getByRole('button', { name: /^Grade 6\b/ }));
    expect(screen.getByRole('combobox', { name: /^Specialist subjects/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove English from specialist subjects' })).toBeInTheDocument();
    expect(screen.queryByText('Using the default for this grade.')).not.toBeInTheDocument();
  });
});
