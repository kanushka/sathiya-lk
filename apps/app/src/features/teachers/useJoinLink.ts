// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type JoinLink } from '@sathiya/core';
import { useDoc, type DocState } from '../../lib/firestore';

export function useJoinLink(sid: string | null): DocState<JoinLink & { id: string }> {
  return useDoc<JoinLink & { id: string }>(sid ? paths.joinLink(sid) : null);
}
