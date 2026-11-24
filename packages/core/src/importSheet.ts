// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export type ImportKind = 'subjects' | 'teachers';
export type SubjectColumn = 'nameEn' | 'nameSi' | 'short';
export type TeacherColumn =
  | 'staffId'
  | 'title'
  | 'name'
  | 'nameSi'
  | 'phone'
  | 'email'
  | 'subjects'
  | 'grades'
  | 'maxPerDay'
  | 'minPerWeek'
  | 'isPrimary';
export type ImportColumn = SubjectColumn | TeacherColumn;

export type ImportErrorCode =
  | 'noSheets'
  | 'ambiguousSheet'
  | 'unknownHeader'
  | 'missingHeader'
  | 'duplicateSheet'
  | 'tooManyRows'
  | 'required'
  | 'nameMissing'
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
  | 'minPerWeek'
  | 'primaryValue'
  | 'phone'
  | 'email'
  | 'subjectsRequired'
  | 'gradesRequired'
  | 'tooLong'
  | 'excelDate'
  | 'excelNumber'
  | 'subjectsChanged'
  | 'alreadyImported';

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

export type ImportCellType = 'date' | 'number';

export interface ImportRow<C extends string> {
  row: number;
  cells: Partial<Record<C, string>>;
  // Spreadsheet cells that weren't text, e.g. a grade range Excel turned into a date.
  cellTypes?: Partial<Record<C, ImportCellType>>;
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
  aliases?: readonly string[];
  // Whole headings from older templates that still map to this column.
  legacy?: readonly string[];
  required: boolean;
}

export const IMPORT_COLUMNS: {
  subjects: readonly ColumnDef<SubjectColumn>[];
  teachers: readonly ColumnDef<TeacherColumn>[];
} = {
  subjects: [
    { key: 'nameEn', en: 'Name (English)', si: 'නම (ඉංග්‍රීසි)', required: false },
    { key: 'nameSi', en: 'Name (Sinhala)', si: 'නම (සිංහල)', required: false },
    { key: 'short', en: 'Short name', si: 'කෙටි නම', required: false },
  ],
  teachers: [
    { key: 'staffId', en: 'Staff ID', si: 'සේවක අංකය', required: false },
    { key: 'title', en: 'Title', si: 'ගෞරව නාමය', required: false },
    { key: 'name', en: 'Name (English)', si: 'නම (ඉංග්‍රීසි)', legacy: ['Full name', 'සම්පූර්ණ නම', 'Full name / සම්පූර්ණ නම'], required: false },
    { key: 'nameSi', en: 'Name (Sinhala)', si: 'නම (සිංහල)', required: false },
    { key: 'phone', en: 'Phone', si: 'දුරකථන', required: false },
    { key: 'email', en: 'Email', si: 'විද්‍යුත් තැපෑල', required: false },
    { key: 'subjects', en: 'Subjects', si: 'විෂයන්', aliases: ['විෂයයන්'], required: false },
    { key: 'grades', en: 'Grades', si: 'ශ්‍රේණි', required: false },
    { key: 'maxPerDay', en: 'Max periods/day', si: 'දිනකට උපරිම කාලච්ඡේද', required: false },
    { key: 'minPerWeek', en: 'Min periods/week', si: 'සතියකට අවම කාලච්ඡේද', required: false },
    { key: 'isPrimary', en: 'Primary teacher?', si: 'ප්‍රාථමික ගුරුවරයෙක්ද?', required: false },
  ],
};

// Each row needs at least one of these two; a sheet needs at least one of the two headings.
export const NAME_COLUMNS: { subjects: readonly [SubjectColumn, SubjectColumn]; teachers: readonly [TeacherColumn, TeacherColumn] } = {
  subjects: ['nameEn', 'nameSi'],
  teachers: ['name', 'nameSi'],
};

export const IMPORT_MAX_ROWS = 200;
export const IMPORT_CELL_MAX = 500;

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

const dropTrailingStars = (s: string) => {
  let end = s.length;
  while (end > 0 && s[end - 1] === '*') end--;
  return s.slice(0, end).trimEnd();
};

const normHeader = (h: string) =>
  dropTrailingStars(h.normalize('NFC').replace(/[\u200c\u200d]/g, '').toLowerCase().trim()).replace(/\s+/g, ' ');

type AnyDef = ColumnDef<ImportColumn>;

const LOOKUP: Record<ImportKind, Map<string, ImportColumn>> = {
  subjects: buildLookup(IMPORT_COLUMNS.subjects),
  teachers: buildLookup(IMPORT_COLUMNS.teachers),
};

function buildLookup(defs: readonly AnyDef[]) {
  const m = new Map<string, ImportColumn>();
  for (const d of defs) {
    for (const si of [d.si, ...(d.aliases ?? [])]) {
      for (const h of [d.en, si, `${d.en} / ${si}`]) m.set(normHeader(h), d.key);
    }
    for (const h of d.legacy ?? []) m.set(normHeader(h), d.key);
  }
  return m;
}

const isBlankRow = (cells: string[]) => cells.every((c) => c === '');

// "Name (English)" / "Name (Sinhala)" head both sheets, so only the other headings decide; a sheet of names alone is a subject list.
function detectKind(headers: string[]): ImportKind | 'ambiguous' | null {
  const keys = headers.map(normHeader);
  const only = (k: ImportKind, o: ImportKind) => keys.filter((h) => LOOKUP[k].has(h) && !LOOKUP[o].has(h)).length;
  const s = only('subjects', 'teachers');
  const t = only('teachers', 'subjects');
  if (s === 0 && t === 0) return keys.some((h) => LOOKUP.subjects.has(h)) ? 'subjects' : null;
  if (s === t) return 'ambiguous';
  return s > t ? 'subjects' : 'teachers';
}

export function readSheets(sheets: RawSheet[]): ParsedSheets {
  const out: ParsedSheets = { subjects: [], teachers: [], errors: [] };
  const seen = new Set<ImportKind>();

  for (const sheet of sheets) {
    const headerRow = (sheet.rows[0] ?? []).map(cellText);
    const kind = detectKind(headerRow);
    if (!kind) continue;
    if (kind === 'ambiguous') {
      out.errors.push({ sheet: 'file', row: null, column: null, code: 'ambiguousSheet', params: { name: sheet.name } });
      continue;
    }
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
        out.errors.push({ sheet: kind, row: 1, column: d.key, code: 'missingHeader', params: { header: d.en, column: d.key } });
      }
    }
    const [enCol, siCol] = NAME_COLUMNS[kind];
    if (!mapped.has(enCol) && !mapped.has(siCol)) {
      const d = (IMPORT_COLUMNS[kind] as readonly AnyDef[]).find((x) => x.key === enCol)!;
      out.errors.push({ sheet: kind, row: 1, column: enCol, code: 'missingHeader', params: { header: d.en, column: enCol } });
    }

    const rows: ImportRow<string>[] = [];
    let overflow = false;
    for (let r = 1; r < sheet.rows.length; r++) {
      const raw = sheet.rows[r] ?? [];
      const texts = raw.map(cellText);
      if (isBlankRow(texts)) continue;
      if (rows.length >= IMPORT_MAX_ROWS) {
        overflow = true;
        break;
      }
      const cells: Record<string, string> = {};
      const cellTypes: Record<string, ImportCellType> = {};
      texts.forEach((t, i) => {
        const key = colAt[i];
        if (!key || t === '') return;
        cells[key] = t;
        const v = raw[i];
        if (v instanceof Date) cellTypes[key] = 'date';
        else if (typeof v === 'number') cellTypes[key] = 'number';
      });
      rows.push({ row: r + 1, cells, ...(Object.keys(cellTypes).length > 0 && { cellTypes }) });
    }
    if (overflow) {
      out.errors.push({ sheet: kind, row: null, column: null, code: 'tooManyRows', params: { max: IMPORT_MAX_ROWS } });
    }
    if (kind === 'subjects') out.subjects = rows as ImportRow<SubjectColumn>[];
    else out.teachers = rows as ImportRow<TeacherColumn>[];
  }

  if (seen.size === 0 && out.errors.length === 0) out.errors.push({ sheet: 'file', row: null, column: null, code: 'noSheets' });
  return out;
}
