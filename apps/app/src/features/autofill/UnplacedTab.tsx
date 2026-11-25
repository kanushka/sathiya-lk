// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { formatAmount, teacherDisplayName, type Lang, type SchoolContext, type Unplaced } from '@sathiya/core';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAdminBase } from '../timetable/paths';
import { itemLabel } from './AllocationTab';

type Fix = 'class' | 'teachers' | 'templates';

function reasonText(u: Unplaced, ctx: SchoolContext, lang: Lang, t: TFunction<'autofill'>, tc: TFunction<'common'>): { text: string; fix: Fix } {
  const p = u.params;
  const day = p['day'] === undefined ? undefined : tc(`days.long.${p['day']}`);
  const teacherObj = typeof p['teacherId'] === 'string' ? ctx.teachers.find((x) => x.id === p['teacherId']) : undefined;
  const teacher = teacherObj ? teacherDisplayName(teacherObj, lang) : undefined;
  const minutes = typeof p['minutes'] === 'number' ? formatAmount(p['minutes'], 'minutes', lang) : '';
  switch (u.reason) {
    case 'no-free-teacher':
      if (p['reason'] === 'unallocated' || p['reason'] === 'staffing') return { text: t(`unplaced.reason.${p['reason']}`), fix: 'teachers' };
      return { text: teacher && day ? t('unplaced.reason.no-free-teacher', { teacher, day }) : t('unplaced.reason.no-free-teacher-any'), fix: 'class' };
    case 'teacher-at-limit':
      return { text: t('unplaced.reason.teacher-at-limit', { teacher: teacher ?? '', day: day ?? '' }), fix: 'teachers' };
    case 'no-room':
      return { text: t('unplaced.reason.no-room'), fix: 'class' };
    case 'minutes-unbuildable':
      return { text: day ? t('unplaced.reason.minutes-unbuildable', { minutes, day }) : t('unplaced.reason.minutes-unbuildable-week', { minutes }), fix: 'templates' };
    case 'block-unavailable':
      return { text: day ? t('unplaced.reason.block-unavailable', { day }) : t('unplaced.reason.block-unavailable-week'), fix: 'class' };
    case 'subject-cap':
      return { text: teacher ? t('unplaced.reason.subject-cap', { teacher }) : t('unplaced.reason.subject-cap-any'), fix: 'teachers' };
    case 'duplicate-option-teacher':
      return { text: t('unplaced.reason.duplicate-option-teacher'), fix: 'teachers' };
    case 'class-teacher-no-daily-subject':
      return { text: '', fix: 'teachers' };
  }
}

export function UnplacedTab({ ctx, unplaced, lang }: { ctx: SchoolContext; unplaced: Unplaced[]; lang: Lang }) {
  const { t } = useTranslation('autofill');
  const { t: tc } = useTranslation('common');
  const base = useAdminBase();
  if (unplaced.length === 0) return <p className="m-0 text-sm text-ink-soft">{t('unplaced.empty')}</p>;
  return (
    <ul className="m-0 list-none divide-y divide-line p-0">
      {unplaced.map((u, i) => {
        const cls = ctx.classes.find((c) => c.id === u.classId);
        const { text, fix } = reasonText(u, ctx, lang, t, tc);
        const missing = u.unit === 'minutes' ? formatAmount(u.missing, 'minutes', lang) : t('periods', { count: u.missing });
        const to = fix === 'class' ? `${base}/timetable/class/${u.classId}` : `${base}/${fix}`;
        const classTeacher = ctx.teachers.find((x) => x.id === u.params['teacherId']);
        const line =
          u.reason === 'class-teacher-no-daily-subject'
            ? t('unplaced.classTeacher', { class: cls?.name ?? u.classId, teacher: classTeacher ? teacherDisplayName(classTeacher, lang) : '' })
            : `${t('unplaced.line', { class: cls?.name ?? u.classId, item: itemLabel(ctx, u.classId, u.planKey, lang), missing })} ${text}`;
        return (
          <li key={`${u.classId}|${u.planKey}|${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm text-ink">
            <span className="min-w-0">{line}</span>
            <Link to={to} target="_blank" rel="noopener" className="shrink-0 font-semibold text-brand">
              {t(`unplaced.fix.${fix}`)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
