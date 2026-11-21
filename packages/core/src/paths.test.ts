import { describe, expect, it } from 'vitest';
import { paths } from './paths';
import { callables } from './api';

describe('paths', () => {
  it('builds firestore paths', () => {
    expect(paths.school('s1')).toBe('schools/s1');
    expect(paths.templates('s1')).toBe('schools/s1/periodTemplates');
    expect(paths.entries('s1', 'y1')).toBe('schools/s1/years/y1/entries');
    expect(paths.publishedClass('s1', 'y1', 'c1')).toBe('schools/s1/years/y1/publishedClasses/c1');
    expect(paths.publishedTeacher('s1', 'y1', 't1')).toBe('schools/s1/years/y1/publishedTeachers/t1');
    expect(paths.directory('s1')).toBe('schoolDirectory/s1');
    expect(paths.platform.config).toBe('platform/config');
    expect(paths.platform.terms('v1')).toBe('platform/terms/versions/v1');
  });
  it('callables map to literal names', () => {
    expect(callables.saveEntry).toBe('saveEntry');
  });
});
