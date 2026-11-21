import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({
  docs: [] as (string | null)[],
  collections: [] as (string | null)[],
  override: {} as Record<string, { loading: boolean; error?: Error }>,
}));

vi.mock('../lib/firebase', () => ({ app: {}, auth: {}, db: {}, functions: {}, storage: {} }));
vi.mock('./AuthProvider', () => ({ useAuth: () => ({ claims: { sid: 's1', role: 'teacher', tid: 't1' } }) }));
vi.mock('../lib/firestore', () => ({
  useDoc: (path: string | null) => {
    calls.docs.push(path);
    return path === 'schools/s1'
      ? {
          loading: false,
          data: { id: 's1', nameEn: 'Siripura', activeYearId: 'y26', colors: { primary: '#7A1F3D', second: '#D9A441' } },
        }
      : { loading: false };
  },
  useCollection: (path: string | null) => {
    calls.collections.push(path);
    return {
      loading: false,
      ...(path ? calls.override[path] : undefined),
      data: path?.endsWith('/years') ? [{ id: 'y27', label: '2027', status: 'draft' }] : path ? [{ id: 'x' }] : [],
    };
  },
}));

const { SchoolProvider, useSchool, useYear } = await import('./SchoolProvider');

function Probe() {
  const s = useSchool();
  const y = useYear();
  return (
    <output data-testid="probe">
      {JSON.stringify({
        name: s.school.nameEn,
        counts: [s.teachers, s.subjects, s.templates, s.grades, s.classes].map((a) => a.length),
        years: y.years.length,
        yearId: y.yearId,
        entries: y.entries.length,
        yearLoading: y.loading,
        yearError: y.error?.message,
        schoolError: s.error?.message,
      })}
    </output>
  );
}

function renderWith(scope?: 'full' | 'school') {
  render(
    <MemoryRouter>
      <SchoolProvider scope={scope}>
        <Probe />
      </SchoolProvider>
    </MemoryRouter>,
  );
  return JSON.parse(screen.getByTestId('probe').textContent ?? '{}');
}

describe('SchoolProvider', () => {
  beforeEach(() => {
    calls.docs.length = 0;
    calls.collections.length = 0;
    calls.override = {};
  });

  it("with scope 'school' opens only the school doc listener", () => {
    const probe = renderWith('school');
    expect(new Set(calls.docs)).toEqual(new Set(['schools/s1']));
    expect(calls.collections.every((p) => p === null)).toBe(true);
    expect(probe).toEqual({ name: 'Siripura', counts: [0, 0, 0, 0, 0], years: 0, yearId: 'y26', entries: 0, yearLoading: false });
    expect(document.documentElement.style.getPropertyValue('--brand')).toBe('#7A1F3D');
  });

  it('with the default full scope subscribes setup, years and entries', () => {
    const probe = renderWith();
    expect(new Set(calls.collections)).toEqual(
      new Set([
        'schools/s1/teachers',
        'schools/s1/subjects',
        'schools/s1/periodTemplates',
        'schools/s1/grades',
        'schools/s1/classes',
        'schools/s1/years',
        'schools/s1/years/y27/entries',
      ]),
    );
    expect(probe).toMatchObject({ counts: [1, 1, 1, 1, 1], years: 1, yearId: 'y27' });
  });

  it('exposes entries loading and error on useYear', () => {
    calls.override = { 'schools/s1/years/y27/entries': { loading: true } };
    expect(renderWith()).toMatchObject({ yearLoading: true });
  });

  it('exposes listener errors on useSchool and useYear', () => {
    calls.override = {
      'schools/s1/subjects': { loading: false, error: new Error('subjects denied') },
      'schools/s1/classes': { loading: false, error: new Error('classes denied') },
      'schools/s1/years/y27/entries': { loading: false, error: new Error('entries denied') },
    };
    expect(renderWith()).toMatchObject({ schoolError: 'subjects denied', yearError: 'entries denied', yearLoading: false });
  });
});
