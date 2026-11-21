// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, expectTypeOf, it } from 'vitest';
import { paths } from './paths';
import { callables, type CallableTypes } from './api';

describe('paths', () => {
  it('builds firestore paths', () => {
    expect(paths.school('s1')).toBe('schools/s1');
    expect(paths.templates('s1')).toBe('schools/s1/periodTemplates');
    expect(paths.entries('s1', 'y1')).toBe('schools/s1/years/y1/entries');
    expect(paths.publishedClass('s1', 'y1', 'c1')).toBe('schools/s1/years/y1/publishedClasses/c1');
    expect(paths.publishedTeacher('s1', 'y1', 't1')).toBe('schools/s1/years/y1/publishedTeachers/t1');
    expect(paths.user('u1')).toBe('users/u1');
    expect(paths.publishedClasses('s1', 'y1')).toBe('schools/s1/years/y1/publishedClasses');
    expect(paths.publishedTeachers('s1', 'y1')).toBe('schools/s1/years/y1/publishedTeachers');
    expect(paths.directory('s1')).toBe('schoolDirectory/s1');
    expect(paths.platform.config).toBe('platform/config');
    expect(paths.platform.terms('v1')).toBe('platform/terms/versions/v1');
  });
  it('callables map to literal names', () => {
    expect(callables.saveEntry).toBe('saveEntry');
  });
  it('CallableTypes covers every callable', () => {
    expectTypeOf<keyof CallableTypes>().toEqualTypeOf<keyof typeof callables>();
    expectTypeOf<CallableTypes['publishYear']['res']>().toEqualTypeOf<{ classes: number; teachers: number }>();
  });
});
