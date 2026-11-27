// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { buildSnapshots, paths, type Year } from '@sathiya/core';
import { C, T, ctx as baseCtx, entries } from '@sathiya/core/fixtures';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollection, useDoc } from '../../lib/firestore';
import { renderWithSchool } from '../../test/renderWithSchool';
import { PrintMyClassPage, PrintMyTimetablePage } from './PrintMine';

vi.mock('../../lib/firestore', () => ({ useDoc: vi.fn(), useCollection: vi.fn() }));

const year: Year = { id: 'y-2026', label: '2026', status: 'published' };
const ctx = { ...baseCtx, school: { ...baseCtx.school, activeYearId: year.id } };
const sid = ctx.school.id;
const built = buildSnapshots(ctx, entries, year);
const claims = { schools: { [sid]: { r: 't' as const, t: T.perera } } };
const docs: Record<string, unknown> = {
  [paths.publishedTeacher(sid, year.id, T.perera)]: built.teachers.find((t) => t.teacherId === T.perera),
  [paths.publishedClass(sid, year.id, C.c6b)]: built.classes.find((c) => c.classId === C.c6b),
  [paths.publishedClass(sid, year.id, C.c6a)]: built.classes.find((c) => c.classId === C.c6a),
};

beforeEach(() => {
  vi.mocked(useDoc).mockReset();
  vi.mocked(useDoc).mockImplementation(((path: string | null) => (path ? { loading: false, data: docs[path] } : { loading: false })) as never);
  vi.mocked(useCollection).mockReset();
  vi.mocked(useCollection).mockReturnValue({ loading: false, data: [ctx.classes.find((c) => c.id === C.c6b)!] } as never);
});

describe('teacher print pages', () => {
  it('prints the signed-in teacher’s own timetable, read by the id in their claim', () => {
    renderWithSchool(<PrintMyTimetablePage />, { ctx, claims, route: `/s/${sid}/me/print/timetable`, path: '/s/:sid/me/print/timetable' });
    expect(screen.getByRole('heading', { name: 'Mrs. N. Perera · SCC024' })).toBeInTheDocument();
    expect(useDoc).toHaveBeenCalledWith(paths.publishedTeacher(sid, year.id, T.perera));
  });

  it('prints the class the teacher is class teacher of', () => {
    renderWithSchool(<PrintMyClassPage />, { ctx, claims, route: `/s/${sid}/me/print/class/${C.c6b}`, path: '/s/:sid/me/print/class/:id' });
    expect(screen.getByRole('heading', { name: /6B/ })).toBeInTheDocument();
  });

  it('treats any other class as not found and never reads it', () => {
    renderWithSchool(<PrintMyClassPage />, { ctx, claims, route: `/s/${sid}/me/print/class/${C.c6a}`, path: '/s/:sid/me/print/class/:id' });
    expect(screen.getByText('Class not found')).toBeInTheDocument();
    expect(useDoc).not.toHaveBeenCalledWith(paths.publishedClass(sid, year.id, C.c6a));
  });
});
