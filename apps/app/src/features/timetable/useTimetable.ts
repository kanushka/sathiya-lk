import { withTeacherIds, type Conflict, type Entry, type EntryDraft, type SchoolContext } from '@sathiya/core';
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

interface Overlay {
  added: Map<string, { entry: Entry; settled: boolean }>;
  removed: Map<string, { settled: boolean }>;
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
  const { t } = useTranslation('timetable');
  const [overlay, setOverlay] = useState<Overlay>(emptyOverlay);
  const [inflight, setInflight] = useState(0);
  const tempId = useRef(0);

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
            return t('errors.conflict.teacher', { name: teacher?.name ?? c.id });
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
      setOverlay((o) => ({ ...o, added: new Map(o.added).set(id, { entry: optimistic, settled: false }) }));
      setInflight((n) => n + 1);
      try {
        await api.saveEntry({ schoolId: ctx.school.id, yearId, entry: draft });
        setOverlay((o) => ({ ...o, added: new Map(o.added).set(id, { entry: optimistic, settled: true }) }));
        return true;
      } catch (err) {
        setOverlay((o) => {
          const added = new Map(o.added);
          added.delete(id);
          return { ...o, added };
        });
        reportError(err);
        return false;
      } finally {
        setInflight((n) => n - 1);
      }
    },
    [api, ctx.school.id, yearId, reportError],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setOverlay((o) => {
        const added = new Map(o.added);
        added.delete(id);
        return { added, removed: new Map(o.removed).set(id, { settled: false }) };
      });
      setInflight((n) => n + 1);
      try {
        await api.deleteEntry({ schoolId: ctx.school.id, yearId, entryId: id });
        setOverlay((o) => ({ ...o, removed: new Map(o.removed).set(id, { settled: true }) }));
        return true;
      } catch (err) {
        setOverlay((o) => {
          const removed = new Map(o.removed);
          removed.delete(id);
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
