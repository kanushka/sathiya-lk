// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { paths, pickName, type Lang, type Relief, type ReliefDay } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { useDoc } from '../../lib/firestore';
import { PrintPage } from './PrintPage';
import { SheetHeader } from './SheetHeader';
import './print.css';

const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

function longDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'si' ? 'si-LK' : 'en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`));
}

export function PrintReliefPage() {
  const { t } = useTranslation('print');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const { school, classes, subjects } = useSchool();
  const { date = '' } = useParams();
  const [params] = useSearchParams();
  const yid = school.activeYearId;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
  const { data, loading, error } = useDoc<ReliefDay>(yid && validDate ? paths.reliefDay(school.id, yid, date) : null);
  const status = error ? 'error' : loading ? 'loading' : data && validDate ? 'ready' : 'notFound';

  const teacherName = (id: string) => {
    const n = data?.names[id];
    return n ? (lang === 'si' && n.si) || n.en : id;
  };
  const classNames = new Map(classes.map((c) => [c.id, c.name]));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const subjectName = (id: string) => {
    const s = subjectById.get(id);
    if (!s) return '';
    return lang === 'si' ? s.nameSi?.trim() || s.short || s.nameEn : s.short || pickName(s, lang);
  };

  const label = (r: Relief) => data?.labels?.[`${r.entryId}|${r.absentTeacherId}`];
  const savedSubject = (r: Relief) => {
    const l = label(r);
    return l && ((lang === 'si' && l.subSi) || l.sub);
  };

  const rows = (data?.reliefs ?? [])
    .map((r: Relief) => ({ r, who: r.reliefTeacherId === null ? null : teacherName(r.reliefTeacherId) }))
    .sort((a, b) => {
      if ((a.who === null) !== (b.who === null)) return a.who === null ? 1 : -1;
      return cmp(a.who ?? '', b.who ?? '') || cmp(a.r.start, b.r.start) || cmp(a.r.entryId, b.r.entryId);
    });

  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 13, background: '#F3F4F6', borderBottom: '1px solid #9aa1b2' } as const;
  const td = { padding: '7px 10px', fontSize: 14, borderBottom: '1px solid #D5D9E2' } as const;
  const cols = ['reliefTeacher', 'period', 'time', 'class', 'subject', 'for'] as const;

  return (
    <PrintPage status={status} auto={params.get('auto') === '1'} icon="teacherView" notFoundTitle={t('relief.emptyTitle')} notFoundBody={t('relief.emptyBody')}>
      <div className="print-sheet print-relief">
        <SheetHeader schoolName={school} {...(school.logoUrl ? { logoUrl: school.logoUrl } : {})} title={t('relief.title')} subtitle={validDate ? longDate(date, lang) : ''} />

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} style={th}>
                  {t(`relief.cols.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, who }, i) => (
              <tr key={`${r.entryId}|${r.absentTeacherId}|${i}`} data-uncovered={who === null ? 'true' : undefined} style={who === null ? { background: '#FDE8E8', color: '#9B1C1C', fontWeight: 700 } : undefined}>
                <td style={td}>{who ?? t('relief.uncovered')}</td>
                <td style={td}>{tc('periods.periodN', { n: r.period })}</td>
                <td style={td}>
                  {r.start}–{r.end}
                </td>
                <td style={td}>{label(r)?.cls ?? r.classIds.map((c) => classNames.get(c) ?? c).sort(cmp).join('+')}</td>
                <td style={td}>{savedSubject(r) ?? subjectName(r.subjectId)}</td>
                <td style={td}>{teacherName(r.absentTeacherId)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: 12, fontSize: 11, color: '#5A6378' }}>
          {t('sheet.madeWith')}
        </footer>
      </div>
    </PrintPage>
  );
}
