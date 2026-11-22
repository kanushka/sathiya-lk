// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import {
  IMPORT_CELL_MAX,
  IMPORT_COLUMNS,
  IMPORT_MAX_ROWS,
  paths,
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
import { docIdList, fail, int, invalid, obj, requireSchoolAdmin } from './lib/guards';
import { createTeacherAccount } from './lib/teacherAccount';

const CONCURRENCY = 5;
const MAX_KNOWN_SUBJECTS = 1000;

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
  const { sid, school } = await requireSchoolAdmin(req, data.schoolId);
  if (!Array.isArray(data.knownSubjectIds) || data.knownSubjectIds.length > MAX_KNOWN_SUBJECTS) {
    invalid(`knownSubjectIds must be a list of at most ${MAX_KNOWN_SUBJECTS} ids`);
  }
  const knownSubjectIds = new Set(docIdList(data.knownSubjectIds, 'knownSubjectIds'));
  const subjectRows = rows(data.subjects, 'subjects', IMPORT_COLUMNS.subjects.map((c) => c.key));
  const teacherRows = rows(data.teachers, 'teachers', IMPORT_COLUMNS.teachers.map((c) => c.key));
  if (subjectRows.length + teacherRows.length === 0) invalid('Nothing to import');

  const [teacherSnap, subjectSnap] = await Promise.all([
    db.collection(paths.teachers(sid)).select('staffId').get(),
    db.collection(paths.subjects(sid)).get(),
  ]);
  // Subject tokens and generated short names were resolved against the client's list; refuse if it is stale.
  if (subjectSnap.size !== knownSubjectIds.size || subjectSnap.docs.some((d) => !knownSubjectIds.has(d.id))) {
    const errors: ImportError[] = [{ sheet: 'file', row: null, column: null, code: 'subjectsChanged' }];
    fail('invalid-argument', 'invalid', 'Subjects changed since the file was checked', { errors });
  }
  const plan = validateImport(
    { subjects: subjectRows, teachers: teacherRows },
    {
      staffPrefix: school.staffPrefix,
      schoolGrades: school.grades,
      subjects: subjectSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subject, 'id'>) })),
      staffIds: teacherSnap.docs.map((d) => d.data().staffId as string),
    },
  );
  if (plan.errors.length > 0) fail('invalid-argument', 'invalid', 'Import has errors', { errors: plan.errors });

  const batch = db.batch();
  const subjectIds = plan.subjects.map((s) => {
    const ref = db.collection(paths.subjects(sid)).doc();
    batch.create(ref, { nameEn: s.nameEn, ...(s.nameSi !== undefined && { nameSi: s.nameSi }), short: s.short, color: s.color });
    return ref.id;
  });
  await batch.commit();

  // All-or-nothing only up to the first account failure: created subjects and teachers stay.
  const created: (ImportSetupRes['teachers'][number] | undefined)[] = [];
  let failed = false;
  let next = 0;
  const worker = async () => {
    while (!failed && next < plan.teachers.length) {
      const i = next++;
      const { teacher, subjectRefs } = plan.teachers[i]!;
      try {
        const { teacherId, password } = await createTeacherAccount(sid, {
          ...teacher,
          subjectIds: subjectRefs.map((r) => ('existingId' in r ? r.existingId : subjectIds[r.newIndex]!)),
        });
        created[i] = { teacherId, staffId: teacher.staffId, name: teacher.name, ...(teacher.title && { title: teacher.title }), password };
      } catch (e) {
        failed = true;
        const { code, message } = (e ?? {}) as { code?: unknown; message?: unknown };
        logger.error('importSetup teacher creation failed', { sid, row: plan.teachers[i]!.row, code: String(code ?? ''), message: String(message ?? e) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, plan.teachers.length) }, worker));

  const notCreated = plan.teachers.filter((_, i) => !created[i]).map((t) => t.teacher.staffId);
  return { subjectIds, teachers: created.filter((t) => t !== undefined), notCreated };
});
