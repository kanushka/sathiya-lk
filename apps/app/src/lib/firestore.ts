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

export function useDoc<T>(path: string | null): DocState<T> {
  const [state, setState] = useState<DocState<T>>({ loading: path !== null });

  useEffect(() => {
    if (path === null) {
      setState({ loading: false });
      return;
    }
    setState({ loading: true });
    return onSnapshot(
      doc(db, path),
      (snap) => {
        const data = snap.data();
        setState({ loading: false, data: data ? withId<T>(snap.id, data) : undefined });
      },
      (error) => setState({ loading: false, error }),
    );
  }, [path]);

  return state;
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
  const [state, setState] = useState<CollectionState<T>>({ data: [], loading: path !== null });
  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;
  const key = path === null ? null : `${path}|${constraintsKey(constraints)}`;

  useEffect(() => {
    if (path === null) {
      setState({ data: [], loading: false });
      return;
    }
    setState({ data: [], loading: true });
    return onSnapshot(
      query(collection(db, path), ...constraintsRef.current),
      (snap) => setState({ loading: false, data: snap.docs.map((d) => withId<T>(d.id, d.data())) }),
      (error) => setState({ data: [], loading: false, error }),
    );
  }, [key]);

  return state;
}
