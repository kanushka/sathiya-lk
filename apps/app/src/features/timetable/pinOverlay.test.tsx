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
const names = { subject: 'Science', teacher: 'Mrs. S. Gunasekara', classes: '6B' };

function overlay(cell: TeacherPinCell, extra: { suggested?: boolean; left?: number; classNote?: string } = {}) {
  return pinOverlayCell({
    cell,
    day: 2,
    n: 4,
    time: '10:00–10:40',
    ctx,
    lang: 'en',
    t,
    tc,
    names,
    progress: { placed: 3, needed: 5, left: extra.left ?? 2, over: 0 },
    suggested: extra.suggested ?? false,
    ...(extra.classNote ? { classNote: extra.classNote } : {}),
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

  it('appends the class period note to a free cell label', () => {
    const o = overlay({ kind: 'free', load: 1, max: 6, limit: false, teacherId: T.gunasekara, subjectThatDay: false }, { classNote: '6B period 5' });
    expect(o.label).toBe('Wednesday, period 4, 10:00–10:40: pin Science with Mrs. S. Gunasekara, 6B period 5');
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
  });
});
