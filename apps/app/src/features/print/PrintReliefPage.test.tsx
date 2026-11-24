// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Relief, ReliefDay, SchoolContext } from '@sathiya/core';
import { C, ctx as baseCtx, S, T } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDoc } from '../../lib/firestore';
import { renderWithSchool } from '../../test/renderWithSchool';
import { PrintReliefPage } from './PrintReliefPage';

vi.mock('../../lib/firestore', () => ({ useDoc: vi.fn() }));

const ctx: SchoolContext = { ...baseCtx, school: { ...baseCtx.school, activeYearId: 'y-2026' } };

const relief = (entryId: string, period: number, start: string, end: string, classId: string, subjectId: string, reliefTeacherId: string | null): Relief => ({
  entryId, absentTeacherId: T.perera, day: 1, period, start, end, classIds: [classId], subjectId, reliefTeacherId,
});

const day = (reliefs: Relief[]): ReliefDay => ({
  date: '2026-11-24',
  day: 1,
  leaves: [],
  reliefs,
  names: {
    [T.perera]: { en: 'Mrs. Perera', si: 'පෙරේරා' },
    [T.bandara]: { en: 'Mr. Bandara', si: 'බණ්ඩාර' },
    [T.ananda]: { en: 'Ven. Ananda' },
  },
  updatedAt: 0,
  updatedBy: 'u',
});

function setup(doc: ReliefDay | undefined, lang: 'en' | 'si' = 'en') {
  vi.mocked(useDoc).mockReturnValue({ data: doc, loading: false });
  return renderWithSchool(<PrintReliefPage />, { ctx, lang, yearId: 'y-2026', route: '/s/siripura/admin/print/relief/2026-11-24', path: '/s/:sid/admin/print/relief/:date' });
}

const bodyRows = () => screen.getAllByRole('row').slice(1);

beforeEach(() => vi.resetAllMocks());

describe('PrintReliefPage', () => {
  it('sorts by relief teacher then time', () => {
    setup(
      day([
        relief('e3', 6, '11:30', '12:10', C.c6a, S.science, T.bandara),
        relief('e2', 3, '09:10', '09:50', C.c6b, S.maths, T.ananda),
        relief('e1', 1, '07:45', '08:30', C.c6a, S.maths, T.bandara),
      ]),
    );
    expect(useDoc).toHaveBeenCalledWith('schools/siripura/years/y-2026/reliefDays/2026-11-24');
    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Mr. Bandara', 'P1', '07:45–08:30', '6A', 'Maths', 'Mrs. Perera']);
    expect(rows[1]).toHaveTextContent('P6');
    expect(rows[2]).toHaveTextContent('Ven. Ananda');
  });

  it('uncovered rows last and highlighted', () => {
    setup(day([relief('e1', 1, '07:45', '08:30', C.c6a, S.maths, null), relief('e2', 3, '09:10', '09:50', C.c6b, S.maths, T.bandara)]));
    const rows = bodyRows();
    expect(rows[0]).toHaveTextContent('Mr. Bandara');
    expect(rows[0]).not.toHaveAttribute('data-uncovered');
    expect(rows[1]).toHaveTextContent('UNCOVERED');
    expect(rows[1]).toHaveAttribute('data-uncovered', 'true');
  });

  it('renders Sinhala labels in si', () => {
    setup(day([relief('e1', 1, '07:45', '08:30', C.c6a, S.maths, T.bandara)]), 'si');
    expect(screen.getByRole('columnheader', { name: 'ආදේශක ගුරුවරයා' })).toBeInTheDocument();
    const cells = within(bodyRows()[0]!).getAllByRole('cell').map((c) => c.textContent);
    expect(cells[0]).toBe('බණ්ඩාර');
    expect(cells[4]).toBe('ගණිතය');
    expect(cells[5]).toBe('පෙරේරා');
  });

  it('shows an empty state when no relief is recorded', () => {
    setup(undefined);
    expect(screen.getByText('No relief recorded for this day')).toBeInTheDocument();
  });
});
