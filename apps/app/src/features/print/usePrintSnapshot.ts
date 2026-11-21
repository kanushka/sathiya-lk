// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { buildSnapshots, paths, type ClassSnapshot, type TeacherSnapshot } from '@sathiya/core';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { useDoc, type DocState } from '../../lib/firestore';

export type PublishedDocHook = <T>(path: string | null) => DocState<T>;

export const PublishedDocContext = createContext<PublishedDocHook>(useDoc);

export type PrintStatus = 'loading' | 'ready' | 'notFound' | 'notPublished' | 'error';

export interface PrintSnapshot<S> {
  status: PrintStatus;
  snapshot?: S;
  auto: boolean;
}

export function usePrintSnapshot(kind: 'class', id: string | undefined): PrintSnapshot<ClassSnapshot>;
export function usePrintSnapshot(kind: 'teacher', id: string | undefined): PrintSnapshot<TeacherSnapshot>;
export function usePrintSnapshot(kind: 'class' | 'teacher', id: string | undefined): PrintSnapshot<ClassSnapshot | TeacherSnapshot> {
  const [params] = useSearchParams();
  const ctx = useSchool();
  const { years, yearId, setYearId, entries, loading, error } = useYear();
  const useDocHook = useContext(PublishedDocContext);
  const published = params.get('published') === '1';
  const auto = params.get('auto') === '1';
  const requested = params.get('year');
  const wanted = requested && years.some((y) => y.id === requested) ? requested : yearId;
  const switching = !published && wanted !== yearId;

  useEffect(() => {
    if (switching) setYearId(wanted);
  }, [switching, wanted, setYearId]);

  const sid = ctx.school.id;
  const publishedYear = requested ?? yearId;
  const publishedPath =
    published && id && publishedYear && !ctx.loading
      ? kind === 'class'
        ? paths.publishedClass(sid, publishedYear, id)
        : paths.publishedTeacher(sid, publishedYear, id)
      : null;
  const doc = useDocHook<ClassSnapshot | TeacherSnapshot>(publishedPath);

  const draft = useMemo(() => {
    if (published || ctx.loading || loading || switching || !id || !yearId) return undefined;
    const year = years.find((y) => y.id === yearId);
    if (!year) return undefined;
    const built = buildSnapshots(ctx, entries, year);
    return kind === 'class' ? built.classes.find((c) => c.classId === id) : built.teachers.find((t) => t.teacherId === id);
  }, [published, ctx, loading, switching, id, years, yearId, entries, kind]);

  if (published) {
    if (ctx.loading || !publishedYear) return { status: 'loading', auto };
    if (doc.error) return { status: 'error', auto };
    if (doc.loading) return { status: 'loading', auto };
    return doc.data ? { status: 'ready', snapshot: doc.data, auto } : { status: 'notPublished', auto };
  }
  if (ctx.error || error) return { status: 'error', auto };
  if (ctx.loading || loading || switching || !yearId) return { status: 'loading', auto };
  return draft ? { status: 'ready', snapshot: draft, auto } : { status: 'notFound', auto };
}
