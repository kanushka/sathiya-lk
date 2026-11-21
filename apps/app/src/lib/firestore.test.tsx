import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = { path: string; next: (snap: unknown) => void; error: (e: Error) => void; closed: boolean };
const listeners = vi.hoisted(() => [] as Listener[]);

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  collection: (_db: unknown, path: string) => ({ path }),
  query: (ref: { path: string }) => ref,
  onSnapshot: (ref: { path: string }, next: Listener['next'], error: Listener['error']) => {
    const l: Listener = { path: ref.path, next, error, closed: false };
    listeners.push(l);
    return () => {
      l.closed = true;
    };
  },
}));

const { useCollection, useDoc } = await import('./firestore');

const open = (path: string) => listeners.filter((l) => l.path === path && !l.closed).at(-1)!;
const docSnap = (id: string, data?: object) => ({ id, data: () => data });
const colSnap = (docs: Array<{ id: string; v: number }>) => ({ docs: docs.map((d) => ({ id: d.id, data: () => ({ v: d.v }) })) });

describe('useDoc', () => {
  beforeEach(() => {
    listeners.length = 0;
  });

  it('never returns the previous path data after the path changes', () => {
    const seen: Array<{ path: string | null; state: unknown }> = [];
    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => {
        const state = useDoc<{ id: string; v: number }>(path);
        seen.push({ path, state });
        return state;
      },
      { initialProps: { path: 'a/1' as string | null } },
    );
    expect(result.current).toEqual({ loading: true });
    act(() => open('a/1').next(docSnap('1', { v: 1 })));
    expect(result.current).toEqual({ loading: false, data: { id: '1', v: 1 } });
    seen.length = 0;
    rerender({ path: 'a/2' });
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) expect(s.state).toEqual({ loading: true });
    act(() => open('a/2').next(docSnap('2', { v: 2 })));
    expect(result.current).toEqual({ loading: false, data: { id: '2', v: 2 } });
    rerender({ path: null });
    expect(result.current).toEqual({ loading: false });
  });

  it('reports errors for the current path', () => {
    const { result } = renderHook(() => useDoc('a/1'));
    const error = new Error('denied');
    act(() => open('a/1').error(error));
    expect(result.current).toEqual({ loading: false, error });
  });
});

describe('useCollection', () => {
  beforeEach(() => {
    listeners.length = 0;
  });

  it('never returns the previous path data after the path changes', () => {
    const seen: unknown[] = [];
    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => {
        const state = useCollection<{ id: string; v: number }>(path);
        seen.push(state);
        return state;
      },
      { initialProps: { path: 'c/a' as string | null } },
    );
    expect(result.current).toEqual({ loading: true, data: [] });
    act(() => open('c/a').next(colSnap([{ id: 'x', v: 1 }])));
    expect(result.current).toEqual({ loading: false, data: [{ id: 'x', v: 1 }] });
    seen.length = 0;
    rerender({ path: 'c/b' });
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) expect(s).toEqual({ loading: true, data: [] });
    act(() => open('c/b').next(colSnap([{ id: 'y', v: 2 }])));
    expect(result.current).toEqual({ loading: false, data: [{ id: 'y', v: 2 }] });
    rerender({ path: null });
    expect(result.current).toEqual({ loading: false, data: [] });
  });

  it('keeps a stable empty array while loading', () => {
    const { result, rerender } = renderHook(() => useCollection('c/a'));
    const first = result.current.data;
    rerender();
    expect(result.current.data).toBe(first);
  });
});
