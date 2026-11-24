// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type JoinRequest } from '@sathiya/core';
import { useMemo } from 'react';
import { useCollection, type CollectionState } from '../../lib/firestore';

export type JoinRequestDoc = JoinRequest & { id: string };

export function useJoinRequests(sid: string | null): CollectionState<JoinRequestDoc> {
  const all = useCollection<JoinRequestDoc>(sid ? paths.joinRequests(sid) : null);
  const pending = useMemo(() => all.data.filter((r) => r.status !== 'rejected'), [all.data]);
  return useMemo(() => ({ ...all, data: pending }), [all, pending]);
}
