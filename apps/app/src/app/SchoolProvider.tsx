import {
  paths,
  type Entry,
  type Grade,
  type PeriodTemplate,
  type School,
  type SchoolClass,
  type SchoolContext,
  type Subject,
  type Teacher,
  type Year,
} from '@sathiya/core';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useCollection, useDoc } from '../lib/firestore';
import { applyBrand, applyDefaultBrand } from '../lib/theme';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';
import { useAuth } from './AuthProvider';

export type SchoolState = SchoolContext & { loading: boolean };

export interface YearState {
  years: Year[];
  yearId: string;
  setYearId(id: string): void;
  entries: Entry[];
}

const SchoolCtx = createContext<SchoolState | null>(null);
const YearCtx = createContext<YearState | null>(null);

export function pickDefaultYear(years: Year[], activeYearId?: string): string {
  if (activeYearId && years.some((y) => y.id === activeYearId)) return activeYearId;
  const sorted = [...years].sort((a, b) => b.label.localeCompare(a.label));
  return (sorted.find((y) => y.status === 'draft') ?? sorted[0])?.id ?? '';
}

export function useHasSchool(): boolean {
  return useContext(SchoolCtx) !== null;
}

export function SchoolProvider({ sid: sidProp, children }: { sid?: string; children: ReactNode }) {
  const { t } = useTranslation('shell');
  const params = useParams();
  const { claims } = useAuth();
  const sid = sidProp ?? params.sid ?? claims.sid ?? null;

  const school = useDoc<School>(sid ? paths.school(sid) : null);
  const teachers = useCollection<Teacher>(sid ? paths.teachers(sid) : null);
  const subjects = useCollection<Subject>(sid ? paths.subjects(sid) : null);
  const templates = useCollection<PeriodTemplate>(sid ? paths.templates(sid) : null);
  const grades = useCollection<Grade>(sid ? paths.grades(sid) : null);
  const classes = useCollection<SchoolClass>(sid ? paths.classes(sid) : null);
  const years = useCollection<Year>(sid ? paths.years(sid) : null);

  const [selectedYear, setYearId] = useState('');
  const sortedYears = useMemo(
    () => [...years.data].sort((a, b) => b.label.localeCompare(a.label)),
    [years.data],
  );
  const yearId = sortedYears.some((y) => y.id === selectedYear)
    ? selectedYear
    : pickDefaultYear(sortedYears, school.data?.activeYearId);
  const entries = useCollection<Entry>(sid && yearId ? paths.entries(sid, yearId) : null);

  const primary = school.data?.colors.primary;
  const second = school.data?.colors.second;
  useEffect(() => {
    if (primary && second) applyBrand({ primary, second });
  }, [primary, second]);
  useEffect(() => applyDefaultBrand, []);

  const loading =
    teachers.loading || subjects.loading || templates.loading || grades.loading || classes.loading || years.loading;

  const schoolValue = useMemo<SchoolState | null>(
    () =>
      school.data
        ? {
            school: school.data,
            teachers: teachers.data,
            subjects: subjects.data,
            templates: templates.data,
            grades: grades.data,
            classes: classes.data,
            loading,
          }
        : null,
    [school.data, teachers.data, subjects.data, templates.data, grades.data, classes.data, loading],
  );

  const yearValue = useMemo<YearState>(
    () => ({ years: sortedYears, yearId, setYearId, entries: entries.data }),
    [sortedYears, yearId, entries.data],
  );

  if (school.loading) return <LoadingState />;
  if (!schoolValue) {
    return <EmptyState icon="profile" title={t('school.missingTitle')} body={t('school.missingBody')} />;
  }
  return (
    <SchoolCtx.Provider value={schoolValue}>
      <YearCtx.Provider value={yearValue}>{children}</YearCtx.Provider>
    </SchoolCtx.Provider>
  );
}

export function useSchool(): SchoolState {
  const ctx = useContext(SchoolCtx);
  if (!ctx) throw new Error('useSchool must be used inside SchoolProvider');
  return ctx;
}

export function useYear(): YearState {
  const ctx = useContext(YearCtx);
  if (!ctx) throw new Error('useYear must be used inside SchoolProvider');
  return ctx;
}
