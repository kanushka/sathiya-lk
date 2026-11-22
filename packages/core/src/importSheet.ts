// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export type ImportKind = 'subjects' | 'teachers';
export type SubjectColumn = 'nameEn' | 'nameSi' | 'short';
export type TeacherColumn =
  | 'staffId'
  | 'title'
  | 'name'
  | 'phone'
  | 'email'
  | 'subjects'
  | 'grades'
  | 'maxPerDay'
  | 'isPrimary';
export type ImportColumn = SubjectColumn | TeacherColumn;

export type ImportErrorCode =
  | 'noSheets'
  | 'unknownHeader'
  | 'missingHeader'
  | 'duplicateSheet'
  | 'tooManyRows'
  | 'required'
  | 'staffIdFormat'
  | 'staffIdTaken'
  | 'staffIdDuplicate'
  | 'nameTaken'
  | 'nameDuplicate'
  | 'shortTaken'
  | 'shortDuplicate'
  | 'shortTooLong'
  | 'unknownTitle'
  | 'unknownSubject'
  | 'gradeFormat'
  | 'gradeNotInSchool'
  | 'maxPerDay'
  | 'primaryValue'
  | 'phone'
  | 'email'
  | 'subjectsRequired'
  | 'gradesRequired'
  | 'tooLong';

export interface ImportError {
  sheet: ImportKind | 'file';
  row: number | null;
  column: ImportColumn | null;
  code: ImportErrorCode;
  params?: Record<string, string | number>;
}

export interface RawSheet {
  name: string;
  rows: unknown[][];
}

export interface ImportRow<C extends string> {
  row: number;
  cells: Partial<Record<C, string>>;
}

export interface ParsedSheets {
  subjects: ImportRow<SubjectColumn>[];
  teachers: ImportRow<TeacherColumn>[];
  errors: ImportError[];
}

interface ColumnDef<K extends ImportColumn> {
  key: K;
  en: string;
  si: string;
  required: boolean;
}

export const IMPORT_COLUMNS: {
  subjects: readonly ColumnDef<SubjectColumn>[];
  teachers: readonly ColumnDef<TeacherColumn>[];
} = {
  subjects: [
    { key: 'nameEn', en: 'Name (English)', si: 'නම (ඉංග්‍රීසි)', required: true },
    { key: 'nameSi', en: 'Name (Sinhala)', si: 'නම (සිංහල)', required: false },
    { key: 'short', en: 'Short name', si: 'කෙටි නම', required: false },
  ],
  teachers: [
    { key: 'staffId', en: 'Staff ID', si: 'සේවක අංකය', required: false },
    { key: 'title', en: 'Title', si: 'ගෞරව නාමය', required: false },
    { key: 'name', en: 'Full name', si: 'සම්පූර්ණ නම', required: true },
    { key: 'phone', en: 'Phone', si: 'දුරකථන', required: false },
    { key: 'email', en: 'Email', si: 'විද්‍යුත් තැපෑල', required: false },
    { key: 'subjects', en: 'Subjects', si: 'විෂයයන්', required: false },
    { key: 'grades', en: 'Grades', si: 'ශ්‍රේණි', required: false },
    { key: 'maxPerDay', en: 'Max periods/day', si: 'දිනකට උපරිම කාලච්ඡේද', required: false },
    { key: 'isPrimary', en: 'Primary teacher?', si: 'ප්‍රාථමික ගුරුවරයෙක්ද?', required: false },
  ],
};

export const IMPORT_MAX_ROWS = 200;

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  return String(v).trim();
}

export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let pending = false;
  const endField = () => {
    row.push(field);
    field = '';
    pending = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
      pending = true;
    } else if (ch === ',') {
      endField();
      pending = true;
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else {
      field += ch;
      pending = true;
    }
  }
  if (pending || field !== '' || row.length > 0) endRow();
  return rows;
}

const normHeader = (h: string) =>
  h
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/\s*\*+$/, '')
    .replace(/\s+/g, ' ');

type AnyDef = ColumnDef<ImportColumn>;

const LOOKUP: Record<ImportKind, Map<string, ImportColumn>> = {
  subjects: buildLookup(IMPORT_COLUMNS.subjects),
  teachers: buildLookup(IMPORT_COLUMNS.teachers),
};

function buildLookup(defs: readonly AnyDef[]) {
  const m = new Map<string, ImportColumn>();
  for (const d of defs) {
    for (const h of [d.en, d.si, `${d.en} / ${d.si}`]) m.set(normHeader(h), d.key);
  }
  return m;
}

const isBlankRow = (cells: string[]) => cells.every((c) => c === '');

function detectKind(headers: string[]): ImportKind | null {
  const score = (k: ImportKind) => headers.filter((h) => LOOKUP[k].has(normHeader(h))).length;
  const s = score('subjects');
  const t = score('teachers');
  if (s === t) return null;
  return s > t ? 'subjects' : 'teachers';
}

export function readSheets(sheets: RawSheet[]): ParsedSheets {
  const out: ParsedSheets = { subjects: [], teachers: [], errors: [] };
  const seen = new Set<ImportKind>();

  for (const sheet of sheets) {
    const headerRow = (sheet.rows[0] ?? []).map(cellText);
    const kind = detectKind(headerRow);
    if (!kind) continue;
    if (seen.has(kind)) {
      out.errors.push({ sheet: kind, row: null, column: null, code: 'duplicateSheet' });
      continue;
    }
    seen.add(kind);

    const lookup = LOOKUP[kind];
    const colAt: (ImportColumn | null)[] = [];
    const mapped = new Set<ImportColumn>();
    headerRow.forEach((h, i) => {
      colAt[i] = null;
      if (h === '') return;
      const key = lookup.get(normHeader(h));
      if (!key || mapped.has(key)) {
        out.errors.push({ sheet: kind, row: 1, column: null, code: 'unknownHeader', params: { header: h } });
        return;
      }
      mapped.add(key);
      colAt[i] = key;
    });

    for (const d of IMPORT_COLUMNS[kind] as readonly AnyDef[]) {
      if (d.required && !mapped.has(d.key)) {
        out.errors.push({ sheet: kind, row: 1, column: d.key, code: 'missingHeader', params: { header: d.en } });
      }
    }

    const rows: ImportRow<string>[] = [];
    let overflow = false;
    for (let r = 1; r < sheet.rows.length; r++) {
      const texts = (sheet.rows[r] ?? []).map(cellText);
      if (isBlankRow(texts)) continue;
      if (rows.length >= IMPORT_MAX_ROWS) {
        overflow = true;
        break;
      }
      const cells: Record<string, string> = {};
      texts.forEach((t, i) => {
        const key = colAt[i];
        if (key && t !== '') cells[key] = t;
      });
      rows.push({ row: r + 1, cells });
    }
    if (overflow) {
      out.errors.push({ sheet: kind, row: null, column: null, code: 'tooManyRows', params: { max: IMPORT_MAX_ROWS } });
    }
    if (kind === 'subjects') out.subjects = rows as ImportRow<SubjectColumn>[];
    else out.teachers = rows as ImportRow<TeacherColumn>[];
  }

  if (seen.size === 0) out.errors.push({ sheet: 'file', row: null, column: null, code: 'noSheets' });
  return out;
}
