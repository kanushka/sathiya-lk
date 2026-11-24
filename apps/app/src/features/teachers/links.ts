// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
export const schoolJoinUrl = (origin: string, sid: string, token: string): string => `${origin}/join/${sid}/${token}`;

export const personalJoinUrl = (origin: string, token: string): string => `${origin}/join/t/${token}`;
