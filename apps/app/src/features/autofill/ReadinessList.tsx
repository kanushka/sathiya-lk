// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { effectivePlan, formatAmount, pickName, planKey, teacherDisplayName, type Lang, type ReadinessCode, type ReadinessIssue, type SchoolContext } from '@sathiya/core';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { useAdminBase } from '../timetable/paths';

type Area = 'grades' | 'teachers' | 'templates';

const AREA: Record<ReadinessCode, Area> = {
  'grade-no-classes': 'grades',
  'class-no-teacher': 'grades',
  'class-teacher-twice': 'grades',
  'class-no-template': 'grades',
  'plan-empty': 'grades',
  'plan-zero-target': 'grades',
  'class-teacher-no-daily-subject': 'teachers',
  'class-teacher-wrong-grade': 'grades',
  'teacher-no-subjects': 'teachers',
  'teacher-no-grades': 'teachers',
  'teacher-no-max': 'teachers',
  'no-qualified-teacher': 'teachers',
  'no-specialist': 'teachers',
  'capacity-short': 'teachers',
  'min-per-week-unreachable': 'teachers',
  'plan-exceeds-template': 'templates',
  'per-day-unbuildable': 'templates',
};

const AREAS: Area[] = ['grades', 'teachers', 'templates'];

interface Entry {
  key: string;
  issue: ReadinessIssue;
  classIds: string[];
  days: number[];
}

const str = (issue: ReadinessIssue, k: string): string => String(issue.params[k] ?? '');

function groupKey(issue: ReadinessIssue): { key: string; by: 'class' | 'day' | null } {
  const base = `${issue.code}|${issue.ref.id}`;
  switch (issue.code) {
    case 'no-qualified-teacher':
      return { key: `${issue.code}|${str(issue, 'grade')}|${str(issue, 'subjectId')}`, by: 'class' };
    case 'no-specialist':
      return { key: `${issue.code}|${str(issue, 'subjectId')}`, by: 'class' };
    case 'plan-zero-target':
      return { key: `${issue.code}|${str(issue, 'planKey')}`, by: 'class' };
    case 'per-day-unbuildable':
      return { key: `${issue.code}|${str(issue, 'classId')}|${str(issue, 'planKey')}|${str(issue, 'minutes')}`, by: 'day' };
    case 'plan-exceeds-template':
      return { key: `${base}|${str(issue, 'unit')}`, by: null };
    default:
      return { key: base, by: null };
  }
}

function groupIssues(issues: ReadinessIssue[]): Entry[] {
  const out = new Map<string, Entry>();
  for (const issue of issues) {
    const { key, by } = groupKey(issue);
    const entry = out.get(key) ?? { key, issue, classIds: [], days: [] };
    if (by === 'class') entry.classIds.push(str(issue, 'classId'));
    if (by === 'day') entry.days.push(Number(issue.params['day']));
    out.set(key, entry);
  }
  return [...out.values()];
}

function describe(entry: Entry, ctx: SchoolContext, lang: Lang, t: TFunction<'autofill'>, tt: TFunction<'timetable'>, tc: TFunction<'common'>): string {
  const { issue } = entry;
  const p = issue.params;
  const str = (k: string): string => String(p[k] ?? '');
  const className = (id: string): string => {
    const cls = ctx.classes.find((c) => c.id === id);
    const grade = cls && ctx.grades.find((g) => g.id === cls.gradeId);
    return cls ? tt('classView.classOption', { grade: grade?.number ?? '', name: cls.name }) : id;
  };
  const teacherName = (id: string): string => {
    const teacher = ctx.teachers.find((x) => x.id === id);
    return teacher ? teacherDisplayName(teacher, lang) : id;
  };
  const subjectName = (id: string): string => {
    const s = ctx.subjects.find((x) => x.id === id);
    return s ? pickName(s, lang) : id;
  };
  const itemName = (classId: string, key: string): string => {
    const cls = ctx.classes.find((c) => c.id === classId);
    const grade = cls && ctx.grades.find((g) => g.id === cls.gradeId);
    const item = cls && grade ? effectivePlan(cls, grade).find((i) => planKey(i) === key) : undefined;
    if (!item) return t('item.unknown');
    return item.kind === 'group' ? pickName(item, lang) : subjectName(item.subjectId);
  };

  const classList = (): string => {
    const found = entry.classIds.map((id) => ctx.classes.find((c) => c.id === id));
    const sameGrade = new Set(found.map((c) => c?.gradeId)).size <= 1;
    return entry.classIds.map((id, i) => (sameGrade ? (found[i]?.name ?? id) : className(id))).join(', ');
  };
  const cls = (): string => className(str('classId') || issue.ref.id);
  switch (issue.code) {
    case 'grade-no-classes':
      return t('messages.grade-no-classes', { grade: str('grade') });
    case 'class-no-teacher':
    case 'class-no-template':
    case 'plan-empty':
      return t(`messages.${issue.code}`, { class: cls() });
    case 'class-teacher-no-daily-subject':
      return t('messages.class-teacher-no-daily-subject', { class: cls(), teacher: teacherName(str('teacherId')) });
    case 'plan-zero-target':
      return t('messages.plan-zero-target', { classes: classList(), item: itemName(str('classId'), str('planKey')) });
    case 'class-teacher-twice':
      return t('messages.class-teacher-twice', { teacher: teacherName(issue.ref.id), classes: str('classes') });
    case 'teacher-no-subjects':
    case 'teacher-no-grades':
    case 'teacher-no-max':
      return t(`messages.${issue.code}`, { teacher: teacherName(issue.ref.id) });
    case 'plan-exceeds-template': {
      const periods = p['unit'] === 'periods';
      const amount = (n: number) => (periods ? t('periods', { count: n }) : formatAmount(n, 'minutes', lang));
      return t('messages.plan-exceeds-template', { class: cls(), needed: amount(Number(p['needed'])), available: amount(Number(p['available'])) });
    }
    case 'per-day-unbuildable':
      return t('messages.per-day-unbuildable', {
        class: cls(),
        item: itemName(str('classId'), str('planKey')),
        minutes: formatAmount(Number(p['minutes']), 'minutes', lang),
        days: entry.days.map((d) => tc(`days.long.${d}`)).join(', '),
      });
    case 'no-qualified-teacher':
      return t('messages.no-qualified-teacher', { classes: classList(), grade: str('grade'), subject: subjectName(str('subjectId')) });
    case 'no-specialist':
      return t('messages.no-specialist', { classes: classList(), subject: subjectName(str('subjectId')) });
    case 'class-teacher-wrong-grade':
      return t('messages.class-teacher-wrong-grade', { class: cls(), teacher: teacherName(str('teacherId')), grade: str('grade') });
    case 'capacity-short':
      return t('messages.capacity-short', { subject: subjectName(str('subjectId')), needed: str('needed'), capacity: str('capacity') });
    case 'min-per-week-unreachable':
      return t('messages.min-per-week-unreachable', { needed: str('needed'), available: str('available') });
  }
}

function IssueItem({ entry }: { entry: Entry }) {
  const { t } = useTranslation('autofill');
  const { t: tt } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const ctx = useSchool();
  const base = useAdminBase();
  const area = AREA[entry.issue.code];
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm text-ink">
      <span className="min-w-0">{describe(entry, ctx, lang, t, tt, tc)}</span>
      <Link to={`${base}/${area}`} className="shrink-0 font-semibold text-brand">
        {t(`fix.${area}`)}
      </Link>
    </li>
  );
}

export function ReadinessList({ issues, grouped }: { issues: ReadinessIssue[]; grouped: boolean }) {
  const { t } = useTranslation('autofill');
  if (!grouped) {
    return (
      <ul className="m-0 list-none divide-y divide-line p-0">
        {groupIssues(issues).map((entry) => (
          <IssueItem key={entry.key} entry={entry} />
        ))}
      </ul>
    );
  }
  return (
    <>
      {AREAS.map((area) => {
        const items = groupIssues(issues.filter((i) => AREA[i.code] === area));
        if (items.length === 0) return null;
        return (
          <section key={area} className="mb-5">
            <h2 className="mb-1 text-base font-bold text-ink">{t(`groups.${area}`)}</h2>
            <ul className="m-0 list-none divide-y divide-line p-0">
              {items.map((entry) => (
                <IssueItem key={entry.key} entry={entry} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
