// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { SchoolReport } from '@sathiya/core';
import { doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCollection, type CollectionState } from '../../lib/firestore';

export const reportsCollectionPath = 'reports';
export const reportPath = (id: string) => `reports/${id}`;

export interface ReportWriter {
  closeReport(id: string): Promise<void>;
}

export const firestoreReportWriter: ReportWriter = {
  closeReport: (id) => updateDoc(doc(db, reportPath(id)), { status: 'closed' }),
};

export function useOpenReports(injected?: CollectionState<SchoolReport>): CollectionState<SchoolReport> {
  const live = useCollection<SchoolReport>(injected ? null : reportsCollectionPath, where('status', '==', 'open'));
  return injected ?? live;
}
