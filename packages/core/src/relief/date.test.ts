// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { colomboToday } from './date';

describe('colomboToday', () => {
  it('maps a weekday instant to Colombo date and day', () => {
    expect(colomboToday(new Date('2026-11-24T02:00:00Z'))).toEqual({ date: '2026-11-24', day: 1 });
  });
  it('rolls over to the next Colombo date after 18:30Z', () => {
    expect(colomboToday(new Date('2026-11-23T19:00:00Z'))).toEqual({ date: '2026-11-24', day: 1 });
  });
  it('returns null day on weekends', () => {
    expect(colomboToday(new Date('2026-11-21T20:00:00Z'))).toEqual({ date: '2026-11-22', day: null });
    expect(colomboToday(new Date('2026-11-21T02:00:00Z'))).toEqual({ date: '2026-11-21', day: null });
  });
});
