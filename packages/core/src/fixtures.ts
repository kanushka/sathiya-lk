// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { withTeacherIds } from './clash';
import type { DayIndex, Entry, Grade, PeriodTemplate, PlanItem, School, SchoolClass, SchoolContext, Subject, Teacher, TemplateRow } from './types';

export const T = {
  wickramasinghe: 't-wickramasinghe',
  kumari: 't-kumari',
  rSilva: 't-r-silva',
  perera: 't-perera',
  rizan: 't-rizan',
  mSilva: 't-m-silva',
  ananda: 't-ananda',
  fernando: 't-fernando',
  bandara: 't-bandara',
  gunasekara: 't-gunasekara',
  jayawardena: 't-jayawardena',
  ranasinghe: 't-ranasinghe',
  wijesekara: 't-wijesekara',
  herath: 't-herath',
  kumara: 't-kumara',
  rajan: 't-rajan',
  fonseka: 't-fonseka',
  dissanayake: 't-dissanayake',
  senanayake: 't-senanayake',
} as const;

export const S = {
  maths: 's-maths',
  science: 's-science',
  sinhala: 's-sinhala',
  english: 's-english',
  history: 's-history',
  geography: 's-geography',
  buddhism: 's-buddhism',
  catholicism: 's-catholicism',
  islam: 's-islam',
  music: 's-music',
  dancing: 's-dancing',
  art: 's-art',
  health: 's-health',
  tamil: 's-tamil',
  pts: 's-pts',
  pali: 's-pali',
} as const;

export const C = { c1a: 'c-1a', c6a: 'c-6a', c6b: 'c-6b', c6c: 'c-6c', c12a: 'c-12a' } as const;

export const TPL = { default: 'tpl-default', shortFriday: 'tpl-short-friday', primary: 'tpl-primary' } as const;

export const G = { g1: 'g-1', g6: 'g-6', g12: 'g-12' } as const;

const p = (start: string, end: string): TemplateRow => ({ type: 'period', start, end });
const interval = (start: string, end: string): TemplateRow => ({ type: 'interval', start, end });

const defaultRows: TemplateRow[] = [
  p('07:45', '08:30'),
  p('08:30', '09:10'),
  p('09:10', '09:50'),
  p('09:50', '10:30'),
  interval('10:30', '10:50'),
  p('10:50', '11:30'),
  p('11:30', '12:10'),
  p('12:10', '12:50'),
  p('12:50', '13:30'),
];

export const defaultTemplate: PeriodTemplate = { id: TPL.default, name: 'School default', isDefault: true, mode: 'same', rows: defaultRows };

export const shortFridayTemplate: PeriodTemplate = {
  id: TPL.shortFriday,
  name: 'Short Friday',
  isDefault: false,
  mode: 'perDay',
  rows: defaultRows,
  days: { 0: defaultRows, 1: defaultRows, 2: defaultRows, 3: defaultRows, 4: defaultRows.slice(0, -1) },
};

export const primaryTemplate: PeriodTemplate = {
  id: TPL.primary,
  name: 'Primary (Gr 1–2)',
  isDefault: false,
  mode: 'same',
  rows: [
    p('07:45', '08:20'),
    p('08:20', '09:00'),
    p('09:00', '09:40'),
    p('09:40', '10:20'),
    interval('10:20', '10:40'),
    p('10:40', '11:05'),
    p('11:05', '11:30'),
  ],
};

export const templates: PeriodTemplate[] = [defaultTemplate, shortFridayTemplate, primaryTemplate];

export const school: School = {
  id: 'siripura',
  nameEn: 'Siripura Central College',
  nameSi: 'සිරිපුර මධ්‍ය විද්‍යාලය',
  district: 'Kurunegala',
  grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  staffPrefix: 'SCC',
  colors: { primary: '#7A1F3D', second: '#D9A441' },
  status: 'active',
  termsVersion: '1',
  createdAt: 0,
};

const subject = (id: string, nameEn: string, nameSi: string, short: string, color: string): Subject => ({ id, nameEn, nameSi, short, color });

export const subjects: Subject[] = [
  subject(S.maths, 'Mathematics', 'ගණිතය', 'Maths', '#D4ECEA'),
  subject(S.science, 'Science', 'විද්‍යාව', 'Science', '#DCE7FA'),
  subject(S.sinhala, 'Sinhala', 'සිංහල', 'Sinhala', '#F2E2E7'),
  subject(S.english, 'English', 'ඉංග්‍රීසි', 'English', '#E3E9D2'),
  subject(S.history, 'History', 'ඉතිහාසය', 'History', '#EFE3D3'),
  subject(S.geography, 'Geography', 'භූගෝල විද්‍යාව', 'Geography', '#E2EEE0'),
  subject(S.buddhism, 'Buddhism', 'බුද්ධ ධර්මය', 'Bud', '#FBEAC9'),
  subject(S.catholicism, 'Catholicism', 'කතෝලික ධර්මය', 'Cath', '#FBEAC9'),
  subject(S.islam, 'Islam', 'ඉස්ලාම් ධර්මය', 'Isl', '#FBEAC9'),
  subject(S.music, 'Music', 'සංගීතය', 'Mus', '#EBDDF2'),
  subject(S.dancing, 'Dancing', 'නර්තනය', 'Dance', '#EBDDF2'),
  subject(S.art, 'Art', 'චිත්‍ර', 'Art', '#EBDDF2'),
  subject(S.health, 'Health & PE', 'සෞඛ්‍ය හා ශාරීරික අධ්‍යාපනය', 'Health & PE', '#DDEFF2'),
  subject(S.tamil, 'Tamil (2nd language)', 'දෙමළ', 'Tamil', '#F0E6DA'),
  subject(S.pts, 'Practical & Technical Skills', 'ප්‍රායෝගික හා තාක්ෂණික කුසලතා', 'PTS', '#E9E9E9'),
  subject(S.pali, 'Pali', 'පාලි', 'Pali', '#FBEAC9'),
];

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const teacher = (id: string, staffId: string, name: string, subjectIds: string[], grades: number[], maxPerDay: number, isPrimary = false): Teacher => ({
  id,
  staffId,
  name,
  isPrimary,
  subjectIds,
  grades,
  maxPerDay,
});

export const teachers: Teacher[] = [
  teacher(T.wickramasinghe, 'SCC003', 'Mrs. S. Wickramasinghe', [], [1], 8, true),
  teacher(T.kumari, 'SCC007', 'Mrs. D. Kumari', [], [2], 8, true),
  teacher(T.rSilva, 'SCC011', 'Mr. R. Silva', [S.sinhala, S.history], [6, 7, 8, 9], 7),
  teacher(T.perera, 'SCC024', 'Mrs. N. Perera', [S.maths, S.science], [6, 7, 8, 10], 7),
  teacher(T.rizan, 'SCC031', 'Mr. A. Rizan', [S.islam, S.english], range(6, 11), 7),
  teacher(T.mSilva, 'SCC036', 'Rev. Fr. M. Silva', [S.catholicism], range(6, 11), 6),
  teacher(T.ananda, 'SCC042', 'Ven. Ananda Thero', [S.buddhism, S.pali], range(6, 13), 6),
  teacher(T.fernando, 'SCC048', 'Mrs. K. Fernando', [S.music, S.dancing], range(6, 11), 7),
  teacher(T.bandara, 'SCC014', 'Mr. P. Bandara', [S.maths], range(6, 11), 7),
  teacher(T.gunasekara, 'SCC019', 'Mrs. S. Gunasekara', [S.science], range(6, 11), 7),
  teacher(T.jayawardena, 'SCC052', 'Mr. T. Jayawardena', [S.maths], range(7, 11), 7),
  teacher(T.ranasinghe, 'SCC016', 'Mrs. J. Ranasinghe', [S.sinhala], range(6, 11), 7),
  teacher(T.wijesekara, 'SCC021', 'Ms. A. Wijesekara', [S.english], range(6, 11), 7),
  teacher(T.herath, 'SCC033', 'Mr. K. Herath', [S.geography], range(6, 11), 7),
  teacher(T.kumara, 'SCC038', 'Mr. S. Kumara', [S.health], range(6, 11), 7),
  teacher(T.rajan, 'SCC046', 'Mrs. V. Rajan', [S.tamil], range(6, 11), 7),
  teacher(T.fonseka, 'SCC050', 'Mr. D. Fonseka', [S.pts], range(6, 11), 7),
  teacher(T.dissanayake, 'SCC055', 'Mrs. L. Dissanayake', [S.art], range(6, 11), 7),
  teacher(T.senanayake, 'SCC058', 'Ms. R. Senanayake', [S.dancing], range(6, 11), 7),
];

const religion = { kind: 'group', key: 'religion', nameEn: 'Religion', nameSi: 'ආගම', optionSubjectIds: [S.buddhism, S.catholicism, S.islam] } as const;
const aesthetic = { kind: 'group', key: 'aesthetic', nameEn: 'Aesthetic', nameSi: 'සෞන්දර්ය', optionSubjectIds: [S.music, S.dancing, S.art] } as const;

export const grades: Grade[] = [
  {
    id: G.g1,
    number: 1,
    plan: [
      { kind: 'subject', subjectId: S.sinhala, perWeek: 8 },
      { kind: 'subject', subjectId: S.maths, perWeek: 7 },
      { kind: 'subject', subjectId: S.english, perWeek: 3 },
      { ...religion, optionSubjectIds: [...religion.optionSubjectIds], perWeek: 3 },
      { kind: 'subject', subjectId: S.tamil, perWeek: 2 },
      { kind: 'subject', subjectId: S.health, perWeek: 3 },
      { kind: 'subject', subjectId: S.music, perWeek: 2 },
      { kind: 'subject', subjectId: S.art, perWeek: 2 },
    ],
  },
  {
    id: G.g6,
    number: 6,
    plan: [
      { kind: 'subject', subjectId: S.maths, perWeek: 6 },
      { kind: 'subject', subjectId: S.science, perWeek: 5 },
      { kind: 'subject', subjectId: S.sinhala, perWeek: 5 },
      { kind: 'subject', subjectId: S.english, perWeek: 5 },
      { kind: 'subject', subjectId: S.history, perWeek: 3 },
      { kind: 'subject', subjectId: S.geography, perWeek: 2 },
      { ...religion, optionSubjectIds: [...religion.optionSubjectIds], perWeek: 3 },
      { ...aesthetic, optionSubjectIds: [...aesthetic.optionSubjectIds], perWeek: 3 },
      { kind: 'subject', subjectId: S.health, perWeek: 3 },
      { kind: 'subject', subjectId: S.tamil, perWeek: 3 },
      { kind: 'subject', subjectId: S.pts, perWeek: 2 },
    ],
  },
  {
    id: G.g12,
    number: 12,
    plan: [
      { kind: 'subject', subjectId: S.maths, perWeek: 18 },
      { kind: 'subject', subjectId: S.science, perWeek: 18 },
      { kind: 'subject', subjectId: S.english, perWeek: 4 },
    ],
  },
];

export const plan12A: PlanItem[] = [
  { kind: 'subject', subjectId: S.buddhism, perWeek: 8 },
  { kind: 'subject', subjectId: S.pali, perWeek: 8 },
  { kind: 'subject', subjectId: S.sinhala, perWeek: 8 },
  { kind: 'subject', subjectId: S.history, perWeek: 8 },
  { kind: 'subject', subjectId: S.geography, perWeek: 4 },
  { kind: 'subject', subjectId: S.english, perWeek: 4 },
];

export const classes: SchoolClass[] = [
  { id: C.c1a, gradeId: G.g1, name: '1A', classTeacherId: T.wickramasinghe, templateId: TPL.primary },
  { id: C.c6a, gradeId: G.g6, name: '6A', classTeacherId: T.bandara, templateId: TPL.default },
  { id: C.c6b, gradeId: G.g6, name: '6B', classTeacherId: T.perera, templateId: TPL.default },
  { id: C.c6c, gradeId: G.g6, name: '6C', classTeacherId: T.dissanayake, templateId: TPL.shortFriday },
  { id: C.c12a, gradeId: G.g12, name: '12A', classTeacherId: T.ananda, templateId: TPL.default, planOverride: plan12A },
];

export const ctx: SchoolContext = { school, teachers, subjects, templates, grades, classes };

export function entry(
  id: string,
  day: DayIndex,
  period: number,
  classIds: string[],
  lessons: Array<[subjectId: string, teacherId: string | null]>,
  groupKey?: string,
): Entry {
  const draft = { day, period, classIds, lessons: lessons.map(([subjectId, teacherId]) => ({ subjectId, teacherId })) };
  return { id, ...withTeacherIds(groupKey ? { ...draft, groupKey } : draft) };
}

type Cell = keyof typeof S | 'religion' | 'aesthetic' | '';

const grid6B: Cell[][] = [
  ['maths', 'sinhala', 'english', 'maths', 'science'],
  ['science', 'maths', 'religion', 'history', 'maths'],
  ['english', 'science', 'maths', 'sinhala', 'aesthetic'],
  ['religion', 'geography', '', 'maths', 'english'],
  ['sinhala', 'health', 'aesthetic', 'english', ''],
  ['history', 'english', 'sinhala', 'religion', ''],
  ['tamil', 'sinhala', 'health', '', 'pts'],
  ['aesthetic', 'tamil', 'history', 'geography', 'tamil'],
];

const teacher6B: Partial<Record<keyof typeof S, string>> = {
  maths: T.perera,
  science: T.gunasekara,
  sinhala: T.rSilva,
  history: T.rSilva,
  english: T.wijesekara,
  geography: T.herath,
  health: T.kumara,
  tamil: T.rajan,
  pts: T.fonseka,
};

function cellEntry(cell: Exclude<Cell, ''>, day: DayIndex, period: number): Entry {
  if (cell === 'religion') {
    return entry(`e-religion-${day}-${period}`, day, period, [C.c6a, C.c6b], [
      [S.buddhism, T.ananda],
      [S.catholicism, T.mSilva],
      [S.islam, T.rizan],
    ], 'religion');
  }
  if (cell === 'aesthetic') {
    return entry(`e-aesthetic-6b-${day}-${period}`, day, period, [C.c6b], [
      [S.music, T.fernando],
      [S.dancing, T.senanayake],
      [S.art, T.dissanayake],
    ], 'aesthetic');
  }
  return entry(`e-6b-${day}-${period}`, day, period, [C.c6b], [[S[cell], teacher6B[cell] ?? null]]);
}

export const entries6B: Entry[] = grid6B.flatMap((row, i) =>
  row.flatMap((cell, day) => (cell === '' ? [] : [cellEntry(cell, day as DayIndex, i + 1)])),
);

export const entries: Entry[] = [
  ...entries6B,
  entry('e-6a-2-4', 2, 4, [C.c6a], [[S.maths, T.perera]]),
  entry('e-6a-0-1', 0, 1, [C.c6a], [[S.maths, T.bandara]]),
  entry('e-6c-4-7', 4, 7, [C.c6c], [[S.science, T.gunasekara]]),
  entry('e-1a-0-1', 0, 1, [C.c1a], [[S.sinhala, T.wickramasinghe]]),
  entry('e-1a-1-3', 1, 3, [C.c1a], [[S.maths, T.wickramasinghe]]),
];
