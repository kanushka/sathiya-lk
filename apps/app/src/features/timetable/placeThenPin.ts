// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { specDraft, type DayIndex, type EntryDraft, type PinSpec } from '@sathiya/core';

export async function placeThenPin(args: {
  spec: PinSpec;
  at: { day: DayIndex; period: number } | null;
  save(d: EntryDraft): Promise<boolean>;
  done(spec: PinSpec): void;
}): Promise<void> {
  const { spec, at, save, done } = args;
  if (at && !(await save(specDraft(spec, at.day, at.period)))) return;
  done(spec);
}
