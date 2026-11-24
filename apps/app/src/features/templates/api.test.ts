// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ addDoc: vi.fn(), collection: vi.fn(), deleteField: vi.fn(), doc: vi.fn(), updateDoc: vi.fn(), writeBatch: vi.fn() }));

import { cleanRows } from './api';

describe('cleanRows', () => {
  it('keeps activity names and subject, trimmed, and drops blanks', () => {
    expect(
      cleanRows([
        { type: 'activity', start: '07:30', end: '07:45', nameEn: ' Assembly ', nameSi: ' ', subjectId: 's-pts' },
        { type: 'period', start: '07:45', end: '08:25', nameEn: 'stray', subjectId: 'x' },
      ]),
    ).toEqual([
      { type: 'activity', start: '07:30', end: '07:45', nameEn: 'Assembly', subjectId: 's-pts' },
      { type: 'period', start: '07:45', end: '08:25' },
    ]);
  });
});
