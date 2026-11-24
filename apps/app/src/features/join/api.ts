// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type JoinRequest, type JoinSchoolRes } from '@sathiya/core';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { call } from '../../lib/callable';
import { db } from '../../lib/firebase';

export interface JoinTarget {
  sid?: string;
  token: string;
}

export function joinSchool(target: JoinTarget, staffId?: string): Promise<JoinSchoolRes> {
  return call('joinSchool', {
    token: target.token,
    ...(target.sid ? { schoolId: target.sid } : {}),
    ...(staffId ? { staffId } : {}),
  });
}

export async function ownJoinRequest(sid: string, uid: string): Promise<JoinRequest | null> {
  const snap = await getDoc(doc(db, `${paths.joinRequests(sid)}/${uid}`));
  return snap.exists() ? (snap.data() as JoinRequest) : null;
}

export function watchOwnJoinRequest(sid: string, uid: string, onChange: (request: JoinRequest | null) => void): () => void {
  return onSnapshot(
    doc(db, `${paths.joinRequests(sid)}/${uid}`),
    (snap) => onChange(snap.exists() ? (snap.data() as JoinRequest) : null),
    () => undefined,
  );
}
