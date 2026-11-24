// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { paths, type ReliefDay, type ReliefNotified, type ReliefStats, type TeacherSnapshot } from '@sathiya/core';
import { collection, getDocs } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { useDoc } from '../../lib/firestore';

export interface ReliefDayState {
  doc: ReliefDay | null;
  snaps: Map<string, TeacherSnapshot>;
  stats: ReliefStats;
  notified: ReliefNotified | null;
  loading: boolean;
  error?: Error;
  reloadSnaps?: () => void;
}

type SnapState = { key: string; snaps: Map<string, TeacherSnapshot>; error?: Error } | null;

const noStats: ReliefStats = { counts: {} };
const noSnaps = new Map<string, TeacherSnapshot>();

export function useReliefDay(sid: string, yid: string | null, date: string): ReliefDayState {
  const day = useDoc<ReliefDay>(yid ? paths.reliefDay(sid, yid, date) : null);
  const stats = useDoc<ReliefStats>(yid ? paths.reliefStats(sid, yid) : null);
  const notified = useDoc<ReliefNotified>(yid ? paths.reliefNotified(sid, yid, date) : null);
  const [snaps, setSnaps] = useState<SnapState>(null);
  const [round, setRound] = useState(0);
  const key = yid ? `${paths.publishedTeachers(sid, yid)}#${round}` : null;

  useEffect(() => {
    if (!yid || key === null) return;
    let live = true;
    getDocs(collection(db, paths.publishedTeachers(sid, yid))).then(
      (snap) => {
        if (live) setSnaps({ key, snaps: new Map(snap.docs.map((d) => [d.id, d.data() as TeacherSnapshot])) });
      },
      (error: Error) => {
        if (live) setSnaps({ key, snaps: noSnaps, error });
      },
    );
    return () => {
      live = false;
    };
  }, [sid, yid, key]);

  const reloadSnaps = useCallback(() => setRound((r) => r + 1), []);
  const loaded = snaps?.key === key ? snaps : null;
  const error = day.error ?? stats.error ?? notified.error ?? loaded?.error;

  return {
    doc: day.data ?? null,
    snaps: loaded?.snaps ?? noSnaps,
    stats: stats.data ?? noStats,
    notified: notified.data ?? null,
    loading: !!yid && (day.loading || stats.loading || notified.loading || !loaded),
    ...(error && { error }),
    reloadSnaps,
  };
}
