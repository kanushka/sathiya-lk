// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { teacherDisplayName, withTeacherIds, type Conflict, type Entry, type EntryDraft, type SchoolContext } from '@sathiya/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { ApiError, call } from '../../lib/callable';
import { useToast } from '../../ui/Toast';

export interface TimetableApi {
  saveEntry(req: { schoolId: string; yearId: string; entry: EntryDraft }): Promise<{ entryId: string }>;
  deleteEntry(req: { schoolId: string; yearId: string; entryId: string }): Promise<{ ok: true }>;
}

const defaultApi: TimetableApi = {
  saveEntry: (req) => call('saveEntry', req),
  deleteEntry: (req) => call('deleteEntry', req),
};

export const TimetableApiContext = createContext<TimetableApi>(defaultApi);

export interface UseTimetable {
  ctx: SchoolContext;
  entries: Entry[];
  save(d: EntryDraft): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  pending: boolean;
}

interface AddedRec { entry: Entry; settled: boolean; serverId?: string }
interface RemovedRec { settled: boolean }
interface Overlay {
  added: Map<string, AddedRec>;
  removed: Map<string, RemovedRec>;
}

const emptyOverlay = (): Overlay => ({ added: new Map(), removed: new Map() });

function conflictsOf(err: ApiError): Conflict[] {
  const c = (err.details as { conflicts?: unknown } | undefined)?.conflicts;
  return Array.isArray(c) ? (c as Conflict[]) : [];
}

export function useTimetable(): UseTimetable {
  const ctx = useSchool();
  const { entries: serverEntries, yearId } = useYear();
  const api = useContext(TimetableApiContext);
  const toast = useToast();
  const { t, i18n } = useTranslation('timetable');
  const [overlay, setOverlay] = useState<Overlay>(emptyOverlay);
  const [inflight, setInflight] = useState(0);
  const tempId = useRef(0);
  const cancelled = useRef(new Set<string>());
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const serverRef = useRef(serverEntries);
  serverRef.current = serverEntries;

  useEffect(() => {
    setOverlay((o) => {
      const added = new Map([...o.added].filter(([, v]) => !v.settled));
      const removed = new Map([...o.removed].filter(([, v]) => !v.settled));
      if (added.size === o.added.size && removed.size === o.removed.size) return o;
      return { added, removed };
    });
  }, [serverEntries]);

  const entries = useMemo(() => {
    const base = serverEntries.filter((e) => !overlay.removed.has(e.id) && !overlay.added.has(e.id));
    return [...base, ...[...overlay.added.values()].map((v) => v.entry)];
  }, [serverEntries, overlay]);

  const reportError = useCallback(
    (err: unknown) => {
      const e = err instanceof ApiError ? err : null;
      if (e?.code === 'clash') {
        const items = conflictsOf(e).map((c) => {
          if (c.kind === 'teacher') {
            const teacher = ctx.teachers.find((x) => x.id === c.id);
            return t('errors.conflict.teacher', { name: teacher ? teacherDisplayName(teacher, i18n.language === 'si' ? 'si' : 'en') : c.id });
          }
          const cls = ctx.classes.find((x) => x.id === c.id);
          return t('errors.conflict.class', { name: cls?.name ?? c.id });
        });
        toast.show(t('errors.clash', { items: items.join('; ') }), 'error');
      } else toast.show(t('errors.generic'), 'error');
    },
    [ctx.teachers, ctx.classes, t, toast],
  );

  const save = useCallback(
    async (draft: EntryDraft): Promise<boolean> => {
      const id = draft.id ?? `tmp-${++tempId.current}`;
      const optimistic: Entry = { ...withTeacherIds(draft), id };
      const rec: AddedRec = { entry: optimistic, settled: false };
      setOverlay((o) => ({ ...o, added: new Map(o.added).set(id, rec) }));
      setInflight((n) => n + 1);
      try {
        const res = await api.saveEntry({ schoolId: ctx.school.id, yearId, entry: draft });
        if (cancelled.current.delete(id)) {
          const del: RemovedRec = { settled: false };
          setOverlay((o) => ({ ...o, removed: new Map(o.removed).set(res.entryId, del) }));
          try {
            await api.deleteEntry({ schoolId: ctx.school.id, yearId, entryId: res.entryId });
            setOverlay((o) => (o.removed.get(res.entryId) === del ? { ...o, removed: new Map(o.removed).set(res.entryId, { settled: true }) } : o));
          } catch (err) {
            setOverlay((o) => {
              if (o.removed.get(res.entryId) !== del) return o;
              const removed = new Map(o.removed);
              removed.delete(res.entryId);
              return { ...o, removed };
            });
            reportError(err);
          }
          return true;
        }
        const alreadyOnServer = !draft.id && serverRef.current.some((e) => e.id === res.entryId);
        setOverlay((o) => {
          if (o.added.get(id) !== rec) return o;
          const added = new Map(o.added);
          if (alreadyOnServer) added.delete(id);
          else added.set(id, { ...rec, settled: true, serverId: res.entryId });
          return { ...o, added };
        });
        return true;
      } catch (err) {
        setOverlay((o) => {
          if (o.added.get(id) !== rec) return o;
          const added = new Map(o.added);
          added.delete(id);
          return { ...o, added };
        });
        if (!cancelled.current.delete(id)) reportError(err);
        return false;
      } finally {
        setInflight((n) => n - 1);
      }
    },
    [api, ctx.school.id, yearId, reportError],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const pendingAdd = overlayRef.current.added.get(id);
      if (pendingAdd && !pendingAdd.settled && id.startsWith('tmp-')) {
        cancelled.current.add(id);
        setOverlay((o) => {
          const added = new Map(o.added);
          added.delete(id);
          return { ...o, added };
        });
        return true;
      }
      const targetId = pendingAdd?.serverId ?? id;
      const rec: RemovedRec = { settled: false };
      setOverlay((o) => {
        const added = new Map(o.added);
        added.delete(id);
        return { added, removed: new Map(o.removed).set(targetId, rec) };
      });
      setInflight((n) => n + 1);
      try {
        await api.deleteEntry({ schoolId: ctx.school.id, yearId, entryId: targetId });
        setOverlay((o) => (o.removed.get(targetId) === rec ? { ...o, removed: new Map(o.removed).set(targetId, { settled: true }) } : o));
        return true;
      } catch (err) {
        setOverlay((o) => {
          if (o.removed.get(targetId) !== rec) return o;
          const removed = new Map(o.removed);
          removed.delete(targetId);
          return { ...o, removed };
        });
        reportError(err);
        return false;
      } finally {
        setInflight((n) => n - 1);
      }
    },
    [api, ctx.school.id, yearId, reportError],
  );

  return { ctx, entries, save, remove, pending: inflight > 0 };
}
