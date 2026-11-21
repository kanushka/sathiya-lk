// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { RegisterSchoolReq } from './api';
import { directoryEntry, directoryLabel } from './directory';
import { school } from './fixtures';
import type { School } from './types';

describe('school city, address and phone', () => {
  it('fixture school is in Kandy', () => {
    expect(school.city).toBe('Kandy');
  });

  it('city is required, address and phone optional', () => {
    expectTypeOf<School['city']>().toEqualTypeOf<string>();
    expectTypeOf<School['address']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<School['phone']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<RegisterSchoolReq['school']['city']>().toEqualTypeOf<string>();
    expectTypeOf<RegisterSchoolReq['school']['address']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<RegisterSchoolReq['school']['phone']>().toEqualTypeOf<string | undefined>();
  });
});

describe('directoryEntry', () => {
  it('copies only the public fields, including city', () => {
    const full: School = { ...school, address: '1 Main St', phone: '0812345678' };
    expect(directoryEntry(full)).toEqual({
      nameEn: 'Siripura Central College',
      nameSi: 'සිරිපුර මධ්‍ය විද්‍යාලය',
      district: 'Kurunegala',
      city: 'Kandy',
      status: 'active',
    });
  });

  it('omits an absent Sinhala name', () => {
    const { nameSi: _, ...noSi } = school;
    expect(directoryEntry(noSi)).not.toHaveProperty('nameSi');
  });
});

describe('directoryLabel', () => {
  it('shows "name, city" in the chosen language with English fallback', () => {
    const e = directoryEntry(school);
    expect(directoryLabel(e, 'en')).toBe('Siripura Central College, Kandy');
    expect(directoryLabel(e, 'si')).toBe('සිරිපුර මධ්‍ය විද්‍යාලය, Kandy');
    expect(directoryLabel({ ...e, nameSi: ' ' }, 'si')).toBe('Siripura Central College, Kandy');
  });

  it('shows the name alone when city is blank', () => {
    expect(directoryLabel({ ...directoryEntry(school), city: '' }, 'en')).toBe('Siripura Central College');
  });
});
