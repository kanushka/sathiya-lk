// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  paths,
  type Entry,
  type Grade,
  type PeriodTemplate,
  type School,
  type SchoolClass,
  type SchoolContext,
  type Subject,
  normalizeTeacher,
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
import { SuspendedSchool } from './SuspendedSchool';
import { useMembershipWatch } from './useMembershipWatch';

export type SchoolState = SchoolContext & { loading: boolean; error?: Error };

export interface YearState {
  years: Year[];
  yearId: string;
  setYearId(id: string): void;
  entries: Entry[];
  loading: boolean;
  error?: Error;
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

export type SchoolScope = 'full' | 'school';

export interface SchoolProviderProps {
  scope?: SchoolScope;
  children: ReactNode;
}

const noYears: Year[] = [];
const noEntries: Entry[] = [];

export function SchoolProvider({ scope = 'full', children }: SchoolProviderProps) {
  const { t } = useTranslation('shell');
  const sid = useParams().sid ?? null;
  const { claims } = useAuth();
  const school = useDoc<School>(sid ? paths.school(sid) : null);
  const suspended = school.data?.status === 'disabled' && claims.super !== true;
  const full = scope === 'full' && school.data && !suspended ? sid : null;
  useMembershipWatch(school.data && !suspended ? sid : null);
  const teachers = useCollection<Teacher>(full ? paths.teachers(full) : null);
  const subjects = useCollection<Subject>(full ? paths.subjects(full) : null);
  const templates = useCollection<PeriodTemplate>(full ? paths.templates(full) : null);
  const grades = useCollection<Grade>(full ? paths.grades(full) : null);
  const classes = useCollection<SchoolClass>(full ? paths.classes(full) : null);
  const years = useCollection<Year>(full ? paths.years(full) : null);

  const [selectedYear, setYearId] = useState('');
  const sortedYears = useMemo(
    () => [...years.data].sort((a, b) => b.label.localeCompare(a.label)),
    [years.data],
  );
  const yearId = !full
    ? (school.data?.activeYearId ?? '')
    : sortedYears.some((y) => y.id === selectedYear)
      ? selectedYear
      : pickDefaultYear(sortedYears, school.data?.activeYearId);
  const entries = useCollection<Entry>(full && yearId ? paths.entries(full, yearId) : null);

  const primary = school.data?.colors.primary;
  const second = school.data?.colors.second;
  useEffect(() => {
    if (primary && second) applyBrand({ primary, second });
  }, [primary, second]);
  useEffect(() => applyDefaultBrand, []);

  const loading =
    teachers.loading || subjects.loading || templates.loading || grades.loading || classes.loading || years.loading;
  const error = [school, teachers, subjects, templates, grades, classes, years].find((l) => l.error)?.error;

  const schoolValue = useMemo<SchoolState | null>(
    () =>
      school.data
        ? {
            school: school.data,
            teachers: teachers.data.map(normalizeTeacher),
            subjects: subjects.data,
            templates: templates.data,
            grades: grades.data,
            classes: classes.data,
            loading,
            ...(error && { error }),
          }
        : null,
    [school.data, teachers.data, subjects.data, templates.data, grades.data, classes.data, loading, error],
  );

  const yearValue = useMemo<YearState>(
    () =>
      full
        ? { years: sortedYears, yearId, setYearId, entries: entries.data, loading: entries.loading, ...(entries.error && { error: entries.error }) }
        : { years: noYears, yearId, setYearId, entries: noEntries, loading: false },
    [full, sortedYears, yearId, entries.data, entries.loading, entries.error],
  );

  if (school.loading) return <LoadingState />;
  if (suspended && sid) return <SuspendedSchool sid={sid} school={school.data!} />;
  if (!schoolValue) {
    return <EmptyState icon="profile" title={t('school.missingTitle')} body={t('school.missingBody')} />;
  }
  return (
    <SchoolCtx.Provider value={schoolValue}>
      <YearCtx.Provider value={yearValue}>{children}</YearCtx.Provider>
    </SchoolCtx.Provider>
  );
}

export function SchoolContextProvider({ school, year, children }: { school: SchoolState; year: YearState; children: ReactNode }) {
  return (
    <SchoolCtx.Provider value={school}>
      <YearCtx.Provider value={year}>{children}</YearCtx.Provider>
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
