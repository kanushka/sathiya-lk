// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, teacherIdOf, type ClassSnapshot, type SchoolClass, type TeacherSnapshot } from '@sathiya/core';
import { where } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { useCollection, useDoc, type DocState } from '../../lib/firestore';
import { PrintPage } from '../print/PrintPage';
import { PrintSheet } from '../print/PrintSheet';
import type { PrintStatus } from '../print/usePrintSnapshot';

function statusOf<T>(doc: DocState<T>, allowed: boolean | null): PrintStatus {
  if (allowed === false) return 'notFound';
  if (allowed === null || doc.loading) return 'loading';
  if (doc.error) return 'error';
  return doc.data ? 'ready' : 'notPublished';
}

/** Prints the signed-in teacher's own published timetable. The teacher id comes from their claim, never the URL. */
export function PrintMyTimetablePage() {
  const { t } = useTranslation('print');
  const { lang } = useLang();
  const { claims } = useAuth();
  const { school } = useSchool();
  const [params] = useSearchParams();
  const tid = teacherIdOf(claims, school.id);
  const yid = school.activeYearId;
  const doc = useDoc<TeacherSnapshot>(tid && yid ? paths.publishedTeacher(school.id, yid, tid) : null);
  const status = !yid ? 'notPublished' : statusOf(doc, !!tid);
  return (
    <PrintPage status={status} auto={params.get('auto') === '1'} icon="teacherView" notFoundTitle={t('states.teacherNotFoundTitle')} notFoundBody={t('states.teacherNotFoundBody')}>
      {doc.data && <PrintSheet kind="teacher" snapshot={doc.data} lang={lang} {...(school.logoUrl ? { logoUrl: school.logoUrl } : {})} />}
    </PrintPage>
  );
}

/** Prints a class the signed-in teacher is class teacher of; any other class id reads as not found. */
export function PrintMyClassPage() {
  const { t } = useTranslation('print');
  const { lang } = useLang();
  const { claims } = useAuth();
  const { school } = useSchool();
  const { id } = useParams();
  const [params] = useSearchParams();
  const tid = teacherIdOf(claims, school.id);
  const yid = school.activeYearId;
  const mine = useCollection<SchoolClass>(tid ? paths.classes(school.id) : null, where('classTeacherId', '==', tid ?? ''));
  // Only a query that worked and lacks the class means not theirs. A failed query is an error, not "not found".
  const allowed = !tid ? false : mine.loading || mine.error ? null : mine.data.some((c) => c.id === id);
  const doc = useDoc<ClassSnapshot>(allowed && id && yid ? paths.publishedClass(school.id, yid, id) : null);
  const status: PrintStatus = mine.error ? 'error' : allowed && !yid ? 'notPublished' : statusOf(doc, allowed);
  return (
    <PrintPage status={status} auto={params.get('auto') === '1'} icon="classView" notFoundTitle={t('states.classNotFoundTitle')} notFoundBody={t('states.classNotFoundBody')}>
      {doc.data && <PrintSheet kind="class" snapshot={doc.data} lang={lang} {...(school.logoUrl ? { logoUrl: school.logoUrl } : {})} />}
    </PrintPage>
  );
}
