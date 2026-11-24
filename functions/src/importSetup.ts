// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import {
  IMPORT_CELL_MAX,
  IMPORT_COLUMNS,
  IMPORT_MAX_ROWS,
  importFingerprint,
  paths,
  subjectsFingerprint,
  validateImport,
  type ImportError,
  type ImportRow,
  type ImportSetupRes,
  type Subject,
} from '@sathiya/core';
import { logger } from 'firebase-functions/logger';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { fail, int, invalid, obj, requireSchoolAdmin } from './lib/guards';
import { releaseImportMarker } from './lib/importMarker';
import { createTeacherRecord } from './lib/teacherRecord';

const CONCURRENCY = 5;
const MAX_VERSION_LENGTH = 64;
const REIMPORT_WINDOW_MS = 24 * 60 * 60 * 1000;

function rows<C extends string>(v: unknown, name: string, columns: readonly C[]): ImportRow<C>[] {
  if (!Array.isArray(v) || v.length > IMPORT_MAX_ROWS) invalid(`${name} must be a list of at most ${IMPORT_MAX_ROWS} rows`);
  return (v as unknown[]).map((item) => {
    const r = obj(item, `${name} row`);
    const cells = obj(r.cells, `${name} cells`);
    const out: Partial<Record<C, string>> = {};
    for (const [k, val] of Object.entries(cells)) {
      if (!(columns as readonly string[]).includes(k)) invalid(`${name} has an unknown column`);
      if (typeof val !== 'string' || val.length > IMPORT_CELL_MAX) invalid(`${name} cells must be text up to ${IMPORT_CELL_MAX} characters`);
      out[k as C] = val as string;
    }
    return { row: int(r.row, `${name} row`, 2, 1_000_000), cells: out };
  });
}

export const importSetup = onCall({ ...callOpts, timeoutSeconds: 300 }, async (req): Promise<ImportSetupRes> => {
  const data = obj(req.data, 'request');
  const { sid, school, uid } = await requireSchoolAdmin(req, data.schoolId);
  if (typeof data.subjectsVersion !== 'string' || data.subjectsVersion.length > MAX_VERSION_LENGTH) {
    invalid(`subjectsVersion must be text up to ${MAX_VERSION_LENGTH} characters`);
  }
  const subjectRows = rows(data.subjects, 'subjects', IMPORT_COLUMNS.subjects.map((c) => c.key));
  const teacherRows = rows(data.teachers, 'teachers', IMPORT_COLUMNS.teachers.map((c) => c.key));
  if (subjectRows.length + teacherRows.length === 0) invalid('Nothing to import');

  const [teacherSnap, subjectSnap] = await Promise.all([
    db.collection(paths.teachers(sid)).select('staffId').get(),
    db.collection(paths.subjects(sid)).get(),
  ]);
  const subjects = subjectSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) }));
  // Subject tokens and generated short names were resolved against the client's list; refuse if it is stale.
  if (subjectsFingerprint(subjects) !== data.subjectsVersion) {
    const errors: ImportError[] = [{ sheet: 'file', row: null, column: null, code: 'subjectsChanged' }];
    fail('invalid-argument', 'invalid', 'Subjects changed since the file was checked', { errors });
  }
  const plan = validateImport(
    { subjects: subjectRows, teachers: teacherRows },
    {
      staffPrefix: school.staffPrefix,
      schoolGrades: school.grades,
      subjects,
      staffIds: teacherSnap.docs.map((d) => d.data().staffId as string),
    },
  );
  if (plan.errors.length > 0) fail('invalid-argument', 'invalid', 'Import has errors', { errors: plan.errors });

  // A retry after a timeout would otherwise create the blank-Staff-ID teachers a second time.
  const marker = db.doc(`${paths.imports(sid)}/${importFingerprint({ subjects: subjectRows, teachers: teacherRows })}`);
  await db.runTransaction(async (tx) => {
    const prev = await tx.get(marker);
    const at = prev.data()?.createdAt;
    if (typeof at === 'number' && Date.now() - at < REIMPORT_WINDOW_MS) {
      const errors: ImportError[] = [{ sheet: 'file', row: null, column: null, code: 'alreadyImported' }];
      fail('invalid-argument', 'invalid', 'This file was already imported', { errors });
    }
    tx.set(marker, { createdAt: Date.now(), createdBy: uid, subjects: subjectRows.length, teachers: teacherRows.length });
  });

  const batch = db.batch();
  const subjectIds = plan.subjects.map((s) => {
    const ref = db.collection(paths.subjects(sid)).doc();
    batch.create(ref, { nameEn: s.nameEn, ...(s.nameSi !== undefined && { nameSi: s.nameSi }), short: s.short, color: s.color });
    return ref.id;
  });
  try {
    await batch.commit();
  } catch (e) {
    await releaseImportMarker(marker, sid);
    throw e;
  }

  // All-or-nothing only up to the first teacher failure: created subjects and teachers stay.
  const created: (ImportSetupRes['teachers'][number] | undefined)[] = [];
  let failed = false;
  let next = 0;
  const worker = async () => {
    while (!failed && next < plan.teachers.length) {
      const i = next++;
      const { teacher, subjectRefs } = plan.teachers[i]!;
      try {
        const teacherId = await createTeacherRecord(sid, {
          ...teacher,
          subjectIds: subjectRefs.map((r) => ('existingId' in r ? r.existingId : subjectIds[r.newIndex]!)),
        });
        created[i] = { teacherId, staffId: teacher.staffId, name: teacher.name, ...(teacher.nameSi !== undefined && { nameSi: teacher.nameSi }), ...(teacher.title && { title: teacher.title }) };
      } catch (e) {
        failed = true;
        // Messages can carry staff IDs, names or emails; the code is enough to diagnose.
        const { code } = (e ?? {}) as { code?: unknown };
        logger.error('importSetup teacher creation failed', { sid, row: plan.teachers[i]!.row, code: String(code ?? 'unknown') });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, plan.teachers.length) }, worker));

  const notCreated = plan.teachers.filter((_, i) => !created[i]).map((t) => t.teacher.staffId);
  if (subjectIds.length === 0 && !created.some(Boolean)) await releaseImportMarker(marker, sid);
  return { subjectIds, teachers: created.filter((t) => t !== undefined), notCreated };
});
