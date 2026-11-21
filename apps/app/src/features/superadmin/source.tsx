import { paths, type School } from '@sathiya/core';
import { collection, getCountFromServer, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { db } from '../../lib/firebase';

export interface UsageCounts {
  teachers: number;
  classes: number;
  entries: number | null;
  lastActivity: number | null | 'error';
}

export interface UsageSource {
  counts(school: School): Promise<UsageCounts>;
}

async function count(path: string): Promise<number> {
  const snap = await getCountFromServer(collection(db, path));
  return snap.data().count;
}

async function lastLogin(sid: string): Promise<number | null | 'error'> {
  try {
    const snap = await getDocs(query(collection(db, paths.teachers(sid)), orderBy('lastLoginAt', 'desc'), limit(1)));
    const v = snap.docs[0]?.data().lastLoginAt;
    return typeof v === 'number' ? v : null;
  } catch {
    return 'error';
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
  const mounted = useRef(true);
  const sourceRef = useRef(source);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (sourceRef.current !== source) {
      sourceRef.current = source;
      requested.current = new Set();
      setState({});
    }
    for (const school of schools) {
      const key = `${school.id}:${school.activeYearId ?? ''}`;
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      const issuedBy = source;
      source.counts(school).then(
        (counts) => {
          if (mounted.current && sourceRef.current === issuedBy) setState((s) => ({ ...s, [school.id]: { status: 'ready', counts } }));
        },
        () => {
          if (mounted.current && sourceRef.current === issuedBy) setState((s) => ({ ...s, [school.id]: { status: 'error' } }));
        },
      );
    }
  }, [schools, source]);

  return state;
}
