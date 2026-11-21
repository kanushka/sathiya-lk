// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, usageCount, type DeleteSetupItemRes, type Entry, type PlanItem, type SchoolContext } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, fail, invalid, obj, requireSchoolAdmin } from './lib/guards';
import { loadContext, loadEntries } from './lib/loadContext';

type Kind = 'teacher' | 'subject' | 'class' | 'template';
const KINDS: Record<Kind, (sid: string) => string> = { teacher: paths.teachers, subject: paths.subjects, class: paths.classes, template: paths.templates };

const planUses = (plan: PlanItem[] | undefined, subjectId: string): number =>
  (plan ?? []).filter((p) => (p.kind === 'subject' ? p.subjectId === subjectId : p.optionSubjectIds.includes(subjectId))).length;

// References outside entries that core usageCount does not see.
function setupRefs(kind: Kind, id: string, ctx: SchoolContext): number {
  switch (kind) {
    case 'subject':
      return ctx.grades.reduce((n, g) => n + planUses(g.plan, id), 0) + ctx.classes.reduce((n, c) => n + planUses(c.planOverride, id), 0);
    case 'teacher':
      return ctx.classes.filter((c) => c.classTeacherId === id).length;
    case 'template':
      return ctx.templates.some((t) => t.id === id && t.isDefault) ? 1 : 0;
    case 'class':
      return 0;
  }
}

// Entry usage counts only the latest year (highest label: the draft being edited); older years keep their snapshots.
async function latestYearEntries(sid: string): Promise<Entry[]> {
  const years = await db.collection(paths.years(sid)).get();
  const latest = years.docs
    .map((y) => ({ id: y.id, label: String(y.get('label') ?? '') }))
    .sort((a, b) => b.label.localeCompare(a.label, 'en', { numeric: true }))[0];
  return latest ? loadEntries(sid, latest.id) : [];
}

export const deleteSetupItem = onCall(callOpts, async (req): Promise<DeleteSetupItemRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const kind = data.kind as Kind;
  if (typeof kind !== 'string' || !Object.hasOwn(KINDS, kind)) invalid('kind must be teacher, subject, class or template');
  const id = docId(data.id, 'id');
  const ref = db.doc(`${KINDS[kind](sid)}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) fail('not-found', 'invalid', `Unknown ${kind}`);

  const [ctx, entries] = await Promise.all([loadContext(sid), kind === 'template' ? Promise.resolve([]) : latestYearEntries(sid)]);
  const usedIn = usageCount(kind, id, ctx, entries) + setupRefs(kind, id, ctx);
  if (usedIn > 0) return { deleted: false, usedIn };

  if (kind !== 'teacher') {
    await ref.delete();
    return { deleted: true, usedIn: 0 };
  }

  const uid = snap.get('uid') as string | undefined;
  const linked = await db.collection(paths.members(sid)).where('teacherId', '==', id).get();
  const batch = db.batch();
  batch.delete(ref);
  if (uid) batch.delete(db.doc(`${paths.members(sid)}/${uid}`));
  // Admin members linked to this teacher keep their admin role but lose the link.
  for (const m of linked.docs) if (m.id !== uid) batch.update(m.ref, { teacherId: FieldValue.delete() });
  if (uid) {
    await auth.deleteUser(uid).catch((e: { code?: string }) => (e.code === 'auth/user-not-found' ? undefined : Promise.reject(e)));
  }
  await batch.commit();
  return { deleted: true, usedIn: 0 };
});
