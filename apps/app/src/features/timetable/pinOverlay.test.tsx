// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { BusyDetail, TeacherPinCell } from '@sathiya/core';
import { C, ctx, S, T } from '@sathiya/core/fixtures';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n, testI18n } from '../../test/render';
import { classCellView } from './labels';
import { pinOverlayCell, PinLegend } from './pinOverlay';

const t = testI18n.getFixedT('en', 'timetable');
const tc = testI18n.getFixedT('en', 'common');
const names = { subject: 'Science', teacher: 'Mrs. S. Gunasekara', classes: '6B', base: '6B' };

function overlay(cell: TeacherPinCell, extra: { suggested?: boolean; left?: number; classNote?: string; teacherView?: boolean; classes?: string } = {}) {
  return pinOverlayCell({
    cell,
    day: 2,
    n: 4,
    time: '10:00–10:40',
    ctx,
    lang: 'en',
    t,
    tc,
    names: extra.classes ? { ...names, classes: extra.classes } : names,
    progress: { placed: 3, needed: 5, left: extra.left ?? 2, over: 0 },
    suggested: extra.suggested ?? false,
    ...(extra.classNote ? { classNote: extra.classNote } : {}),
    ...(extra.teacherView ? { teacherView: true } : {}),
    entryView: (e) => classCellView(e, ctx, 'en', t),
  })!;
}

const teaching = (classIds: string[], entryId: string): BusyDetail => ({ kind: 'teacher', classIds, subjectId: S.science, teacherId: T.gunasekara, entryId }) as BusyDetail;

describe('pinOverlayCell', () => {
  it('keeps a single blocker label unchanged and shows no more-count', () => {
    const b = teaching([C.c6a], 'x');
    const o = overlay({ kind: 'busy', busy: b, blockers: [b] });
    expect(o.label).toBe('Wednesday, period 4, 10:00–10:40: busy, Teaching 6A · Science');
    expect(o.disabled).toBe(true);
    renderWithI18n(<>{o.content}</>);
    expect(screen.getByText('Teaching 6A · Science')).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it('joins every blocker in the label and title and counts the rest', () => {
    const a = teaching([C.c6a], 'x');
    const b = teaching([C.c6c], 'y');
    const o = overlay({ kind: 'busy', busy: a, blockers: [a, b] });
    expect(o.label).toBe('Wednesday, period 4, 10:00–10:40: busy, Teaching 6A · Science; Teaching 6C · Science');
    expect(o.title).toBe('Teaching 6A · Science; Teaching 6C · Science');
    renderWithI18n(<>{o.content}</>);
    expect(screen.getByText('Teaching 6A · Science')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('greys out a row with no period of the class', () => {
    const o = overlay({ kind: 'none' });
    expect(o.disabled).toBe(true);
    expect(o.className).toContain('bg-[#F6F7F9]');
    expect(o.label).toBe('Wednesday, period 4, 10:00–10:40: no 6B period at this time');
    renderWithI18n(<>{o.content}</>);
    expect(screen.getByText('No 6B period')).toBeInTheDocument();
  });

  it('names the base class, not the joined classes, in a no-period row', () => {
    const o = overlay({ kind: 'none' }, { classes: '6A+6B', teacherView: true });
    expect(o.label).toBe('Wednesday, period 4, 10:00–10:40: no 6B period at this time');
    renderWithI18n(<>{o.content}</>);
    expect(screen.getByText('No 6B period')).toBeInTheDocument();
  });

  it('names the class instead of the teacher on a free teacher-view cell', () => {
    const o = overlay({ kind: 'free', load: 1, max: 6, limit: false, teacherId: T.gunasekara, subjectThatDay: false }, { teacherView: true });
    expect(o.label).toBe('Wednesday, period 4, 10:00–10:40: pin Science for 6B');
  });

  it('appends the class period note to a free cell label', () => {
    const o = overlay({ kind: 'free', load: 1, max: 6, limit: false, teacherId: T.gunasekara, subjectThatDay: false }, { classNote: '6B period 5' });
    expect(o.label).toBe('Wednesday, period 4, 10:00–10:40: pin Science with Mrs. S. Gunasekara, 6B period 5');
    renderWithI18n(<>{o.content}</>);
    expect(screen.getByText('6B period 5')).toBeInTheDocument();
  });

  it('shows the class period note on a suggested cell too', () => {
    const o = overlay({ kind: 'free', load: 1, max: 6, limit: false, teacherId: T.gunasekara, subjectThatDay: false }, { suggested: true, classNote: '6B P5 · 10:00–10:40' });
    expect(o.label).toBe('Wednesday, period 4, 10:00–10:40: pin Science with Mrs. S. Gunasekara, 6B P5 · 10:00–10:40, suggested');
    renderWithI18n(<>{o.content}</>);
    expect(screen.getByText('6B P5 · 10:00–10:40')).toBeInTheDocument();
  });

  it('names the busy teacher in a group cell', () => {
    const b: BusyDetail = { kind: 'teacher', classIds: [C.c12a], subjectId: S.pali, teacherId: T.ananda, entryId: 'x' };
    const o = pinOverlayCell({
      cell: { kind: 'busy', busy: b, blockers: [b] },
      day: 2,
      n: 4,
      time: '10:00–10:40',
      ctx,
      lang: 'en',
      t,
      tc,
      names: { subject: 'Religion', teacher: 'Ven. Ananda Thero', classes: '6C', base: '6C' },
      progress: null,
      suggested: false,
      group: true,
      entryView: (e) => classCellView(e, ctx, 'en', t),
    })!;
    expect(o.label).toBe('Wednesday, period 4, 10:00–10:40: busy, Ven. Ananda Thero · Teaching 12A · Pali');
    renderWithI18n(<>{o.content}</>);
    expect(screen.getByText('Ven. Ananda Thero · Teaching 12A · Pali')).toBeInTheDocument();
  });

  it('names a pinned group cell by the group, whatever the entry view title', () => {
    const e = { id: 'g', day: 2 as const, period: 4, classIds: [C.c6c], lessons: [{ subjectId: S.buddhism, teacherId: T.ananda }], teacherIds: [T.ananda], groupKey: 'religion' };
    const o = pinOverlayCell({
      cell: { kind: 'pinned', entry: e },
      day: 2,
      n: 4,
      time: '10:00–10:40',
      ctx,
      lang: 'en',
      t,
      tc,
      names: { subject: 'Religion', teacher: 'Ven. Ananda Thero', classes: '6C', base: '6C' },
      progress: null,
      suggested: false,
      group: true,
      entryView: () => ({ title: '⧉ 6C', sub: 'Buddhism', color: '#fff', isGroup: true }),
    })!;
    expect(o.label).toBe('Wednesday, period 4, 10:00–10:40: Religion 6C, pinned, click to unpin');
  });

  it('flags a suggested cell', () => {
    const o = overlay({ kind: 'free', load: 1, max: 6, limit: false, teacherId: T.gunasekara, subjectThatDay: false }, { suggested: true });
    expect(o.label).toMatch(/, suggested$/);
  });
});

describe('PinLegend', () => {
  it('lists the teacher in the free swatch', () => {
    renderWithI18n(<PinLegend teacher="Mrs. S. Gunasekara" />);
    expect(screen.getByLabelText('Pin mode legend')).toHaveTextContent('Free for Mrs. S. Gunasekara');
    expect(screen.getByLabelText('Pin mode legend')).not.toHaveTextContent('in this row');
  });

  it('names the classes and the no-period swatch on teacher rows', () => {
    renderWithI18n(<PinLegend teacher="Mr. A. Rizan" teacherRows={{ classes: '6A+6B', base: '6B' }} />);
    const legend = screen.getByLabelText('Pin mode legend');
    expect(legend).toHaveTextContent('Free for Mr. A. Rizan and 6A+6B');
    expect(legend).toHaveTextContent('No 6B period in this row');
  });
});
