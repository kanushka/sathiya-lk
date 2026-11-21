import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ docs: [] as (string | null)[], collections: [] as (string | null)[] }));

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
  });

  it("with scope 'school' opens only the school doc listener", () => {
    const probe = renderWith('school');
    expect(new Set(calls.docs)).toEqual(new Set(['schools/s1']));
    expect(calls.collections.every((p) => p === null)).toBe(true);
    expect(probe).toEqual({ name: 'Siripura', counts: [0, 0, 0, 0, 0], years: 0, yearId: 'y26', entries: 0 });
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
});
