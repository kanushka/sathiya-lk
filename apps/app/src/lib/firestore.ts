import {
  collection,
  doc,
  onSnapshot,
  query,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { db } from './firebase';

export interface DocState<T> {
  data?: T;
  loading: boolean;
  error?: Error;
}

export interface CollectionState<T> {
  data: T[];
  loading: boolean;
  error?: Error;
}

function withId<T>(id: string, data: DocumentData): T {
  return { id, ...data } as T;
}

const idleDoc: DocState<never> = { loading: false };
const loadingDoc: DocState<never> = { loading: true };
const noData: never[] = [];
const idleCollection: CollectionState<never> = { data: noData, loading: false };
const loadingCollection: CollectionState<never> = { data: noData, loading: true };

// State is tagged with the key it was loaded for, so a key change never exposes the previous key's data.
type Keyed<S> = { key: string; state: S } | null;

export function useDoc<T>(path: string | null): DocState<T> {
  const [current, setCurrent] = useState<Keyed<DocState<T>>>(null);

  useEffect(() => {
    if (path === null) return;
    return onSnapshot(
      doc(db, path),
      (snap) => {
        const data = snap.data();
        setCurrent({ key: path, state: data ? { loading: false, data: withId<T>(snap.id, data) } : { loading: false } });
      },
      (error) => setCurrent({ key: path, state: { loading: false, error } }),
    );
  }, [path]);

  if (path === null) return idleDoc;
  return current?.key === path ? current.state : loadingDoc;
}

function constraintsKey(constraints: QueryConstraint[]): string {
  try {
    return JSON.stringify(constraints);
  } catch {
    return String(constraints.length);
  }
}

// Constraint objects are new on every render, so the listener is keyed by their serialised form
// (falling back to the count when a value such as a DocumentReference cannot be serialised).
export function useCollection<T>(path: string | null, ...constraints: QueryConstraint[]): CollectionState<T> {
  const [current, setCurrent] = useState<Keyed<CollectionState<T>>>(null);
  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;
  const key = path === null ? null : `${path}|${constraintsKey(constraints)}`;

  useEffect(() => {
    if (path === null || key === null) return;
    return onSnapshot(
      query(collection(db, path), ...constraintsRef.current),
      (snap) => setCurrent({ key, state: { loading: false, data: snap.docs.map((d) => withId<T>(d.id, d.data())) } }),
      (error) => setCurrent({ key, state: { data: noData, loading: false, error } }),
    );
  }, [key]);

  if (key === null) return idleCollection;
  return current?.key === key ? current.state : loadingCollection;
}
