// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { colomboToday, paths, planReliefMail, reliefKey, teacherDisplayName, type ReliefDay, type ReliefNotified } from '@sathiya/core';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { mailConfig } from './email/params';
import { MAIL, mailDoc } from './email/send';
import { reliefAssigned, reliefCancelled } from './email/templates';
import { db } from './lib/admin';
import { REGION } from './lib/callOptions';
import { loadContext } from './lib/loadContext';
import { runTx } from './lib/tx';
import type { ReliefMailArgs } from './relief/mailQueue';

export async function runReliefMail(args: ReliefMailArgs): Promise<'sent' | 'skipped' | 'superseded'> {
  const { sid, yid, date, teacherId, savedAt } = args;
  const notifiedRef = db.doc(paths.reliefNotified(sid, yid, date));
  const notified = (await notifiedRef.get()).data() as Partial<ReliefNotified> | undefined;
  if (notified?.pending?.[teacherId] !== savedAt) return 'superseded';

  // A task delayed past midnight would mail yesterday's relief as today's.
  const mail = date === colomboToday(new Date()).date ? await buildMail(args, notified) : null;

  return runTx(async (tx) => {
    const [fresh, existing] = await Promise.all([tx.get(notifiedRef), mail ? tx.get(mail.ref) : Promise.resolve(null)]);
    if ((fresh.data() as Partial<ReliefNotified> | undefined)?.pending?.[teacherId] !== savedAt) return 'superseded';
    const patch: Record<string, Record<string, unknown>> = { pending: { [teacherId]: FieldValue.delete() } };
    if (mail) {
      if (!existing?.exists) tx.create(mail.ref, mail.doc);
      patch.sent = { [teacherId]: { key: mail.key, at: Date.now() } };
    }
    tx.set(notifiedRef, patch, { merge: true });
    return mail ? 'sent' : 'skipped';
  });
}

async function buildMail(args: ReliefMailArgs, notified: Partial<ReliefNotified>): Promise<{ ref: DocumentReference; doc: object; key: string } | null> {
  const { sid, yid, date, teacherId, savedAt } = args;
  const [daySnap, ctx] = await Promise.all([db.doc(paths.reliefDay(sid, yid, date)).get(), loadContext(sid)]);
  const day = daySnap.data() as ReliefDay | undefined;
  const reliefs = day?.reliefs ?? [];
  const key = reliefKey(reliefs, teacherId);
  const plan = planReliefMail(key, notified.sent?.[teacherId]?.key);
  const teacher = ctx.teachers.find((t) => t.id === teacherId);
  if (!plan || !teacher || !day) return null;

  let to = teacher.email?.trim();
  if (!to && teacher.uid) {
    to = ((await db.doc(`${paths.members(sid)}/${teacher.uid}`).get()).data() as { email?: string } | undefined)?.email?.trim();
  }
  if (!to) return null;

  const names = day.names;
  const nameEn = names[teacherId]?.en ?? teacherDisplayName(teacher, 'en');
  const nameSi = names[teacherId]?.si;
  const todayUrl = `${mailConfig().appUrl}/s/${sid}/me`;
  const school = ctx.school;
  const message =
    plan === 'cancelled'
      ? reliefCancelled({ school, teacherName: nameEn, teacherNameSi: nameSi, date, todayUrl })
      : reliefAssigned({
          school,
          teacherName: nameEn,
          teacherNameSi: nameSi,
          date,
          todayUrl,
          rows: reliefs
            .filter((r) => r.reliefTeacherId === teacherId)
            .sort((a, b) => a.period - b.period || a.entryId.localeCompare(b.entryId))
            .map((r) => {
              const subject = ctx.subjects.find((s) => s.id === r.subjectId);
              const absent = names[r.absentTeacherId];
              return {
                period: r.period,
                start: r.start,
                end: r.end,
                className: r.classIds.map((id) => ctx.classes.find((c) => c.id === id)?.name ?? id).join('+'),
                subject: subject?.short || subject?.nameEn || r.subjectId,
                forTeacher: absent?.en ?? r.absentTeacherId,
                subjectSi: subject?.nameSi || undefined,
                forTeacherSi: absent?.si,
              };
            }),
        });
  const doc = mailDoc({ to: [to], message });
  return doc && { ref: db.collection(MAIL).doc(`relief-${sid}-${date}-${teacherId}-${savedAt}`), doc, key };
}

export const reliefMail = onTaskDispatched(
  { region: REGION, retryConfig: { maxAttempts: 3 }, rateLimits: { maxConcurrentDispatches: 6 } },
  (req) => runReliefMail(req.data as ReliefMailArgs).then(() => undefined),
);
