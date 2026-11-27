// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import {
  colomboToday,
  nextSchoolDay,
  paths,
  teacherIdOf,
  type ClassSnapshot,
  type DayIndex,
  type ReliefDay,
  type SchoolClass,
  type Teacher,
  type TeacherSnapshot,
} from '@sathiya/core';
import { where } from 'firebase/firestore';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '../../app/AuthProvider';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { useCollection, useDoc, type CollectionState, type DocState } from '../../lib/firestore';
import { colomboNow } from './colomboNow';
import { overlayRelief, type OverlaySnapshot } from './reliefOverlay';
import { useNow, type NowFn } from './useNow';

/** Data a test hands in instead of the live Firestore reads. Every field given replaces one listener. */
export interface TeacherInjected {
  now?: NowFn;
  snapshot?: DocState<TeacherSnapshot>;
  /** Relief days by date; a date that is missing reads as no relief. */
  reliefDays?: Record<string, ReliefDay | null>;
  classes?: SchoolClass[];
  classSnapshots?: Record<string, ClassSnapshot | null>;
  teacher?: DocState<Teacher>;
}

export interface SchoolDate {
  date: string;
  day: DayIndex | null;
}

export interface TeacherData {
  sid: string;
  yearId: string | undefined;
  tid: string | null;
  /** Colombo wall-clock time as a local Date (getDay, getHours read Colombo values). */
  now: Date;
  today: SchoolDate;
  next: { date: string; day: DayIndex };
  snapshot: DocState<TeacherSnapshot>;
  base: TeacherSnapshot | null;
  reliefOn: (date: string) => ReliefDay | null;
  /** Whether the relief days for today and the next school day are still loading, or failed. A missing doc is no relief. */
  relief: { loading: boolean; error?: Error };
  /** The snapshot with the relief of that date laid over it (relief is read for today and the next school day). */
  snapFor: (date: string) => OverlaySnapshot | null;
  classes: CollectionState<SchoolClass>;
  injected: TeacherInjected;
}

const Ctx = createContext<TeacherData | null>(null);

export function useTeacherData(): TeacherData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTeacherData must be used inside TeacherDataProvider');
  return v;
}

export function TeacherDataProvider({ injected, children }: { injected: TeacherInjected; children: ReactNode }) {
  const { claims } = useAuth();
  const { lang } = useLang();
  const { school } = useSchool();
  const instant = useNow(injected.now);
  const sid = school.id;
  const yearId = school.activeYearId;
  const tid = teacherIdOf(claims, sid);

  const today = colomboToday(instant);
  const next = nextSchoolDay(instant);

  const live = useDoc<TeacherSnapshot>(!injected.snapshot && yearId && tid ? paths.publishedTeacher(sid, yearId, tid) : null);
  const snapshot = injected.snapshot ?? live;
  const reliefPath = (date: string, on: boolean) => (!injected.reliefDays && on && yearId ? paths.reliefDay(sid, yearId, date) : null);
  const todayLive = useDoc<ReliefDay>(reliefPath(today.date, today.day !== null));
  const nextLive = useDoc<ReliefDay>(reliefPath(next.date, true));
  const liveClasses = useCollection<SchoolClass>(!injected.classes && tid ? paths.classes(sid) : null, where('classTeacherId', '==', tid ?? ''));
  const classes = useMemo<CollectionState<SchoolClass>>(
    () => (injected.classes ? { loading: false, data: injected.classes } : liveClasses),
    [injected.classes, liveClasses],
  );
  const reliefError = todayLive.error ?? nextLive.error;
  const relief = injected.reliefDays
    ? { loading: false }
    : { loading: todayLive.loading || nextLive.loading, ...(reliefError && { error: reliefError }) };

  const todayData = todayLive.data ?? null;
  const nextData = nextLive.data ?? null;
  const reliefOn = useCallback(
    (date: string): ReliefDay | null => {
      if (injected.reliefDays) return injected.reliefDays[date] ?? null;
      if (date === today.date) return todayData;
      if (date === next.date) return nextData;
      return null;
    },
    [injected.reliefDays, today.date, next.date, todayData, nextData],
  );

  const base = snapshot.data ?? null;
  const snapFor = useCallback(
    (date: string): OverlaySnapshot | null => (base ? overlayRelief(base, reliefOn(date), base.teacherId, lang) : null),
    [base, reliefOn, lang],
  );

  const value: TeacherData = {
    sid,
    yearId,
    tid: tid ?? null,
    now: colomboNow(instant),
    today,
    next,
    snapshot,
    base,
    reliefOn,
    relief,
    snapFor,
    classes,
    injected,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The published class timetable, or the injected one in tests. */
export function useClassSnapshot(cid: string | undefined): DocState<ClassSnapshot> {
  const { sid, yearId, injected } = useTeacherData();
  const live = useDoc<ClassSnapshot>(!injected.classSnapshots && cid && yearId ? paths.publishedClass(sid, yearId, cid) : null);
  if (!injected.classSnapshots) return live;
  const data = cid ? injected.classSnapshots[cid] : undefined;
  return data ? { loading: false, data } : { loading: false };
}

/** The caller's own teacher record (name, staff ID, email, phone), or the injected one in tests. */
export function useOwnTeacher(): DocState<Teacher> {
  const { sid, tid, injected } = useTeacherData();
  const live = useDoc<Teacher>(!injected.teacher && tid ? `${paths.teachers(sid)}/${tid}` : null);
  return injected.teacher ?? live;
}
