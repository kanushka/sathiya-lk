// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { DAY_INDEXES, paths, rowsFor, usageCount, type DeleteSetupItemReq, type DeleteSetupItemRes, type PlanItem, type SchoolContext } from '@sathiya/core';
import { FieldValue, type DocumentSnapshot, type QuerySnapshot } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { syncClaimsAndRevoke } from './lib/claims';
import { docId, fail, invalid, obj, requireSchoolAdmin } from './lib/guards';
import { loadContext } from './lib/loadContext';
import { runTx } from './lib/tx';
import { latestYearEntries } from './lib/yearEntries';

type Kind = DeleteSetupItemReq['kind'];
const KINDS: Record<Kind, (sid: string) => string> = { teacher: paths.teachers, subject: paths.subjects, class: paths.classes, template: paths.templates, grade: paths.grades };

const planUses = (plan: PlanItem[] | undefined, subjectId: string): number =>
  (plan ?? []).filter((p) => (p.kind === 'subject' ? p.subjectId === subjectId : p.optionSubjectIds.includes(subjectId))).length;

const activityUses = (ctx: SchoolContext, subjectId: string): number =>
  ctx.templates.reduce<number>((n, t) => n + DAY_INDEXES.reduce<number>((m, d) => m + rowsFor(t, d).filter((r) => r.type === 'activity' && r.subjectId === subjectId).length, 0), 0);

// References outside entries that core usageCount does not see.
function setupRefs(kind: Kind, id: string, ctx: SchoolContext): number {
  switch (kind) {
    case 'subject':
      return ctx.grades.reduce((n, g) => n + planUses(g.plan, id), 0) + ctx.classes.reduce((n, c) => n + planUses(c.planOverride, id), 0) + activityUses(ctx, id);
    case 'teacher':
      return ctx.classes.filter((c) => c.classTeacherId === id).length;
    case 'template':
      return ctx.templates.some((t) => t.id === id && t.isDefault) ? 1 : 0;
    case 'class':
    case 'grade':
      return 0;
  }
}

const IN_LIMIT = 30;

// A grade goes with its classes, so any year's entries for those classes block it.
async function deleteGrade(sid: string, id: string): Promise<DeleteSetupItemRes> {
  return db.runTransaction(async (tx) => {
    const gradeRef = db.doc(`${paths.grades(sid)}/${id}`);
    const [grade, classes, years] = await Promise.all([
      tx.get(gradeRef),
      tx.get(db.collection(paths.classes(sid)).where('gradeId', '==', id)),
      tx.get(db.collection(paths.years(sid))),
    ]);
    if (!grade.exists) fail('not-found', 'invalid', 'Unknown grade');
    const classIds = classes.docs.map((c) => c.id);
    const chunks: string[][] = [];
    for (let i = 0; i < classIds.length; i += IN_LIMIT) chunks.push(classIds.slice(i, i + IN_LIMIT));
    const snaps = await Promise.all(
      years.docs.flatMap((y) => chunks.map((ids) => tx.get(db.collection(paths.entries(sid, y.id)).where('classIds', 'array-contains-any', ids)))),
    );
    const usedIn = new Set(snaps.flatMap((s) => s.docs.map((d) => d.ref.path))).size;
    if (usedIn > 0) return { deleted: false, usedIn };
    tx.delete(gradeRef);
    for (const c of classes.docs) tx.delete(c.ref);
    return { deleted: true, usedIn: 0 };
  });
}

export const deleteSetupItem = onCall(callOpts, async (req): Promise<DeleteSetupItemRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const kind = data.kind as Kind;
  if (typeof kind !== 'string' || !Object.hasOwn(KINDS, kind)) invalid('kind must be teacher, subject, class, template or grade');
  const id = docId(data.id, 'id');
  if (kind === 'grade') return deleteGrade(sid, id);
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

  const membersRef = db.collection(paths.members(sid));
  const requestsRef = db.collection(paths.joinRequests(sid));
  const accountsOf = (teacher: DocumentSnapshot, linked: QuerySnapshot) => {
    const uid = teacher.get('uid') as string | undefined;
    return [...new Set([...linked.docs.map((m) => m.id), ...(uid ? [uid] : [])])];
  };
  // Revoke first: if the commit or claim sync then fails, the accounts must sign in again, where claimInvites repairs claims.
  const revoked = accountsOf(snap, await membersRef.where('teacherId', '==', id).get());
  await Promise.all(revoked.map((u) => auth.revokeRefreshTokens(u)));
  const affected = await runTx(async (tx) => {
    const [teacher, linked, requests] = await Promise.all([tx.get(ref), tx.get(membersRef.where('teacherId', '==', id)), tx.get(requestsRef.where('teacherId', '==', id))]);
    if (!teacher.exists) fail('not-found', 'invalid', 'Unknown teacher');
    const uids = accountsOf(teacher, linked);
    const members = await Promise.all(uids.map((u) => tx.get(membersRef.doc(u))));
    tx.delete(ref);
    requests.docs.forEach((r) => tx.delete(r.ref));
    // An admin member is never removed: it only loses the link to this teacher. A teacher-only member is removed.
    for (const m of members) {
      if (!m.exists) continue;
      if (m.get('role') === 'admin') {
        if (m.get('teacherId') === id) tx.update(m.ref, { teacherId: FieldValue.delete() });
      } else tx.delete(m.ref);
    }
    return members.filter((m) => m.exists).map((m) => m.id);
  });
  await syncClaimsAndRevoke(affected);
  return { deleted: true, usedIn: 0 };
});
