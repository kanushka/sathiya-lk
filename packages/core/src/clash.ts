import { overlaps, windowOf } from './time';
import type { Entry, EntryDraft, SchoolContext } from './types';

export interface Conflict { kind: 'teacher' | 'class'; id: string; entryId: string }

export function entryWindow(e: EntryDraft, ctx: SchoolContext): { start: number; end: number } | null {
  const classId = e.classIds[0];
  const cls = ctx.classes.find((c) => c.id === classId);
  const template = cls && ctx.templates.find((t) => t.id === cls.templateId);
  return template ? windowOf(template, e.day, e.period) : null;
}

function lessonTeachers(e: EntryDraft): string[] {
  const ids: string[] = [];
  for (const l of e.lessons) if (l.teacherId !== null && !ids.includes(l.teacherId)) ids.push(l.teacherId);
  return ids;
}

export function withTeacherIds(draft: EntryDraft): EntryDraft & { teacherIds: string[] } {
  return { ...draft, teacherIds: lessonTeachers(draft) };
}

export function findConflicts(draft: EntryDraft, existing: Entry[], ctx: SchoolContext): Conflict[] {
  const window = entryWindow(draft, ctx);
  if (!window) return [];
  const teachers = lessonTeachers(draft);
  const classIds = [...new Set(draft.classIds)];
  const out: Conflict[] = [];
  for (const e of existing) {
    if (draft.id !== undefined && e.id === draft.id) continue;
    if (e.day !== draft.day) continue;
    const other = entryWindow(e, ctx);
    if (!other || !overlaps(window, other)) continue;
    const otherTeachers = new Set(lessonTeachers(e));
    for (const t of teachers) if (otherTeachers.has(t)) out.push({ kind: 'teacher', id: t, entryId: e.id });
    for (const c of classIds) if (e.classIds.includes(c)) out.push({ kind: 'class', id: c, entryId: e.id });
  }
  return out;
}
