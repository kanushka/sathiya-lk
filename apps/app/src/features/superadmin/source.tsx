import { paths, type School } from '@sathiya/core';
import { collection, getCountFromServer, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { db } from '../../lib/firebase';

export interface UsageCounts {
  teachers: number;
  classes: number;
  entries: number | null;
  lastActivity: number | null;
}

export interface UsageSource {
  counts(school: School): Promise<UsageCounts>;
}

async function count(path: string): Promise<number> {
  const snap = await getCountFromServer(collection(db, path));
  return snap.data().count;
}

async function lastLogin(sid: string): Promise<number | null> {
  try {
    const snap = await getDocs(query(collection(db, paths.teachers(sid)), orderBy('lastLoginAt', 'desc'), limit(1)));
    const v = snap.docs[0]?.data().lastLoginAt;
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
}

export const firestoreUsageSource: UsageSource = {
  async counts(school) {
    const [teachers, classes, entries, lastActivity] = await Promise.all([
      count(paths.teachers(school.id)),
      count(paths.classes(school.id)),
      school.activeYearId ? count(paths.entries(school.id, school.activeYearId)) : Promise.resolve(null),
      lastLogin(school.id),
    ]);
    return { teachers, classes, entries, lastActivity };
  },
};

const UsageCtx = createContext<UsageSource>(firestoreUsageSource);

export function UsageSourceProvider({ value, children }: { value: UsageSource; children: ReactNode }) {
  return <UsageCtx.Provider value={value}>{children}</UsageCtx.Provider>;
}

export type CountState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; counts: UsageCounts };

export function useUsageCounts(schools: School[]): Record<string, CountState> {
  const source = useContext(UsageCtx);
  const [state, setState] = useState<Record<string, CountState>>({});
  const requested = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    for (const school of schools) {
      if (requested.current.has(school.id)) continue;
      requested.current.add(school.id);
      source.counts(school).then(
        (counts) => alive && setState((s) => ({ ...s, [school.id]: { status: 'ready', counts } })),
        () => alive && setState((s) => ({ ...s, [school.id]: { status: 'error' } })),
      );
    }
    return () => {
      alive = false;
      requested.current.clear();
    };
  }, [schools, source]);

  return state;
}
