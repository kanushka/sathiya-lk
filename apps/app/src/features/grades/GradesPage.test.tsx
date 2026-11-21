// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { C, ctx, entries, G, S } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('grades page', () => {
  it('total shows 40/40 for canvas plan', async () => {
    await openGrade6();
    expect(screen.getByTestId('plan-total')).toHaveTextContent('40 / 40');
  });

  it('group option remove and add', async () => {
    const user = await openGrade6();
    await user.click(screen.getByRole('button', { name: 'Remove Music from Aesthetic' }));
    const afterRemove = vi.mocked(api.saveGradePlan).mock.calls[0]![2];
    const aesthetic = afterRemove.find((p) => p.kind === 'group' && p.key === 'aesthetic');
    expect(aesthetic).toMatchObject({ optionSubjectIds: [S.dancing, S.art] });
    expect(vi.mocked(api.saveGradePlan).mock.calls[0]![1]).toBe(G.g6);

    await user.selectOptions(screen.getByLabelText('Add option to Aesthetic'), 'Pali');
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

  it('read-only hides every write control', async () => {
    flags.readOnly = true;
    const user = await openGrade6();
    expect(screen.queryByRole('button', { name: /Add class/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add grade/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add subject|Add group/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Custom plan' })).toBeNull();
    expect(screen.queryByLabelText('Add option to Aesthetic')).toBeNull();
    expect(screen.getByLabelText('Periods per week for Mathematics')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Grade 1\b/ }));
    expect(api.saveGradePlan).not.toHaveBeenCalled();
  });
});
