// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { effectivePlan, pickName, planKey, teacherDisplayName, teachesSubject, type Allocation, type Lang, type SchoolContext } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { Select } from '../../ui/Select';
import { sortedClasses } from '../timetable/ClassViewPage';

export const allocationKey = (a: Pick<Allocation, 'classId' | 'planKey' | 'subjectId'>): string => `${a.classId}|${a.planKey}|${a.subjectId}`;

export function itemLabel(ctx: SchoolContext, classId: string, key: string, lang: Lang): string {
  const cls = ctx.classes.find((c) => c.id === classId);
  const grade = cls && ctx.grades.find((g) => g.id === cls.gradeId);
  const item = cls && grade ? effectivePlan(cls, grade).find((i) => planKey(i) === key) : undefined;
  if (item?.kind === 'group') return pickName(item, lang);
  const subjectId = item?.subjectId ?? key.replace(/^subject:/, '');
  const s = ctx.subjects.find((x) => x.id === subjectId);
  return s ? pickName(s, lang) : subjectId;
}

export function AllocationTab({
  ctx,
  allocation,
  edits,
  lang,
  onEdit,
}: {
  ctx: SchoolContext;
  allocation: Allocation[];
  edits: Map<string, string>;
  lang: Lang;
  onEdit(row: Allocation, teacherId: string): void;
}) {
  const { t } = useTranslation('autofill');
  const { t: tt } = useTranslation('timetable');
  if (allocation.length === 0) return <p className="m-0 text-sm text-ink-soft">{t('allocation.empty')}</p>;
  const subjectName = (id: string) => {
    const s = ctx.subjects.find((x) => x.id === id);
    return s ? pickName(s, lang) : id;
  };
  const classes = sortedClasses(ctx).filter((c) => allocation.some((a) => a.classId === c.id));

  return (
    <div>
      <p className="m-0 mb-3 text-sm text-ink-soft">{t('allocation.hint')}</p>
      {classes.map((cls) => {
        const grade = ctx.grades.find((g) => g.id === cls.gradeId);
        const rows = allocation.filter((a) => a.classId === cls.id);
        return (
          <section key={cls.id} className="mb-5">
            <h3 className="mb-1 text-sm font-bold text-ink">{tt('classView.classOption', { grade: grade?.number ?? '', name: cls.name })}</h3>
            <ul className="m-0 list-none divide-y divide-line p-0">
              {rows.map((row) => {
                const key = allocationKey(row);
                const value = edits.get(key) ?? row.teacherId ?? '';
                const subject = row.planKey.startsWith('group:')
                  ? t('allocation.groupOption', { group: itemLabel(ctx, cls.id, row.planKey, lang), subject: subjectName(row.subjectId) })
                  : subjectName(row.subjectId);
                const options = ctx.teachers
                  .filter((x) => x.id === value || x.id === row.teacherId || (grade !== undefined && teachesSubject(x, row.subjectId, grade.number)))
                  .map((x) => ({ value: x.id, label: teacherDisplayName(x, lang) }))
                  .sort((a, b) => a.label.localeCompare(b.label));
                return (
                  <li key={key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                    <span className="min-w-0 text-sm text-ink">{subject}</span>
                    <Select
                      aria-label={t('allocation.teacherFor', { subject, class: cls.name })}
                      size="sm"
                      value={value}
                      placeholder={t('allocation.noTeacher')}
                      onChange={(id) => onEdit(row, id)}
                      options={options}
                      className="w-full sm:w-64"
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
