// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx } from '@sathiya/core/fixtures';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import type { PublishProblems } from './model';
import { PublishModal } from './PublishModal';

const none: PublishProblems = { incomplete: 0, clashes: 0, overLimit: 0, overTarget: 0, orphaned: 0, groupNoTeacher: 0, total: 0 };

const show = (problems: PublishProblems) =>
  renderWithSchool(<PublishModal yearLabel="2026" problems={problems} onPublish={vi.fn()} onClose={vi.fn()} />, { ctx });

describe('PublishModal', () => {
  it('keeps the plain wording when nothing needs attention', () => {
    show(none);
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.queryByText(/need attention|needs attention/)).not.toBeInTheDocument();
  });

  it('lists a count per kind and offers Publish anyway', () => {
    show({ incomplete: 5, clashes: 1, overLimit: 1, overTarget: 2, orphaned: 1, groupNoTeacher: 0, total: 10 });
    expect(screen.getByText('10 problems need attention:')).toBeInTheDocument();
    for (const line of ['5 classes not complete', '1 clash', '1 teacher over the daily limit', '2 subjects over their plan', '1 entry outside the period template']) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(screen.queryByText(/without a teacher/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish anyway' })).toBeInTheDocument();
  });

  it('uses the singular title for one problem', () => {
    show({ ...none, orphaned: 1, total: 1 });
    expect(screen.getByText('1 problem needs attention:')).toBeInTheDocument();
  });
});
