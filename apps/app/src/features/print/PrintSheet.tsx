// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { pickName } from '@sathiya/core';
import type { ClassSnapshot, DayIndex, Lang, SnapshotCell, TeacherSnapshot, TemplateRow } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import './print.css';

const DAYS: DayIndex[] = [0, 1, 2, 3, 4];

type Props = ({ kind: 'class'; snapshot: ClassSnapshot } | { kind: 'teacher'; snapshot: TeacherSnapshot }) & { lang: Lang; logoUrl?: string };

interface CellText {
  title: string;
  sub: string;
}

function printedDate(lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'si' ? 'si-LK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
}

function periodNumber(rows: TemplateRow[], index: number): number {
  return rows.slice(0, index + 1).filter((r) => r.type === 'period').length;
}

export function PrintSheet(props: Props) {
  const { t } = useTranslation('print');
  const { t: tc } = useTranslation('common');
  const { snapshot, kind, lang, logoUrl } = props;
  const rows = snapshot.rows;
  const rowCount = Math.max(...DAYS.map((d) => rows[d]?.length ?? 0));
  const className = kind === 'class' ? props.snapshot.className : '';

  const byKey = new Map<string, SnapshotCell[]>();
  for (const c of snapshot.cells) {
    const key = `${c.day}-${c.period}`;
    byKey.set(key, [...(byKey.get(key) ?? []), c]);
  }

  function textOf(c: SnapshotCell, row: TemplateRow, stacked: boolean): CellText {
    const title = lang === 'si' && c.titleSi ? c.titleSi : c.title;
    if (kind === 'teacher') {
      const names = c.title
        .split('+')
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .join('+');
      const classes = c.isGroup || c.title.includes('+') ? t('sheet.joined', { classes: names }) : names;
      const subject = lang === 'si' && c.subSi ? c.subSi : c.sub;
      const showTime = stacked || c.start !== row.start || c.end !== row.end;
      return { title: classes, sub: showTime ? t('sheet.cellTime', { subject, time: `${c.start}–${c.end}` }) : subject };
    }
    const others = c.otherClasses ?? [];
    const teacher = (lang === 'si' && c.subSi) || c.sub;
    if (c.isGroup) return { title, sub: others.length ? t('sheet.groupWith', { classes: others.join('+') }) : t('sheet.group') };
    if (others.length) {
      const classes = [className, ...others].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('+');
      return { title, sub: teacher ? t('sheet.joinedWithTeacher', { classes, teacher }) : t('sheet.joined', { classes }) };
    }
    return { title, sub: teacher };
  }

  const groupNames = kind === 'class' ? [...new Set(snapshot.cells.filter((c) => c.isGroup).map((c) => (lang === 'si' && c.titleSi ? c.titleSi : c.title)))] : [];
  const title = kind === 'class' ? t('sheet.classTitle', { grade: props.snapshot.gradeNumber, name: props.snapshot.className }) : t('sheet.teacherTitle', { name: (lang === 'si' && props.snapshot.nameSi) || props.snapshot.name, staffId: props.snapshot.staffId });
  const classTeacher = kind === 'class' ? (lang === 'si' && props.snapshot.classTeacherSi) || props.snapshot.classTeacher : undefined;
  const subtitle = [t('sheet.subtitle', { year: snapshot.yearLabel }), classTeacher ? t('sheet.classTeacher', { name: classTeacher }) : ''].filter(Boolean).join(' · ');

  const grid = [];
  for (let i = 0; i < rowCount; i++) {
    const present = DAYS.flatMap((d) => (rows[d]?.[i] ? [{ d, row: rows[d]![i]! }] : []));
    const first = present[0]?.row;
    if (!first) continue;
    if (present.every((p) => p.row.type !== 'period')) {
      grid.push(
        <div
          key={`r${i}`}
          style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, letterSpacing: '.2em', color: '#7A5410', background: '#FBF1DC' }}
        >
          {t('sheet.interval', { start: first.start, end: first.end })}
        </div>,
      );
      continue;
    }
    const labelDay = present.find((p) => p.row.type === 'period')!;
    const sameTimes = present.every((p) => p.row.start === labelDay.row.start && p.row.end === labelDay.row.end);
    grid.push(
      <div key={`l${i}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 10px', background: '#F9FAFB' }}>
        <b style={{ fontSize: 14 }}>{periodNumber(rows[labelDay.d]!, i)}</b>
        <span style={{ fontSize: 11, color: '#5A6378' }}>
          {labelDay.row.start}–{labelDay.row.end}
        </span>
      </div>,
    );
    for (const d of DAYS) {
      const row = rows[d]?.[i];
      if (!row) {
        grid.push(<div key={`${i}-${d}`} style={{ background: '#F3F4F6' }} />);
        continue;
      }
      if (row.type !== 'period') {
        grid.push(
          <div key={`${i}-${d}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#7A5410', background: '#FBF1DC' }}>
            {t('sheet.interval', { start: row.start, end: row.end })}
          </div>,
        );
        continue;
      }
      const n = periodNumber(rows[d]!, i);
      const cells = byKey.get(`${d}-${n}`) ?? [];
      grid.push(
        <div
          key={`${i}-${d}`}
          data-testid="print-slot"
          data-day={d}
          data-period={n}
          data-empty={cells.length === 0 ? 'true' : 'false'}
          aria-label={t('sheet.slotLabel', { day: tc(`days.long.${d}`), n })}
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 10px', gap: 2, overflow: 'hidden' }}
        >
          {!sameTimes && (
            <span style={{ fontSize: 9, color: '#5A6378' }}>
              {row.start}–{row.end}
            </span>
          )}
          {cells.map((c, k) => {
            const text = textOf(c, row, cells.length > 1);
            return (
              <div key={k} data-testid="print-cell" style={{ display: 'flex', flexDirection: 'column', borderTop: k > 0 ? '1px dashed #C4C9D4' : undefined, paddingTop: k > 0 ? 2 : 0 }}>
                <b style={{ fontSize: cells.length > 1 ? 12 : 14 }}>{text.title}</b>
                {text.sub && <span style={{ fontSize: cells.length > 1 ? 10 : 11, color: '#3B4560' }}>{text.sub}</span>}
              </div>
            );
          })}
        </div>,
      );
    }
  }

  return (
    <div className="print-sheet">
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 14, borderBottom: '3px solid var(--brand)' }}>
        {logoUrl && <img data-testid="school-logo" src={logoUrl} alt="" width={56} height={56} style={{ objectFit: 'contain' }} />}
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{pickName(snapshot.schoolName, 'en')}</p>
          {snapshot.schoolName.nameEn.trim() && snapshot.schoolName.nameSi && <p style={{ margin: '2px 0 0', fontSize: 14, color: '#3B4560' }}>{snapshot.schoolName.nameSi}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: 'var(--brand)', lineHeight: 1 }}>{title}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#3B4560' }}>{subtitle}</p>
        </div>
      </header>

      <div className="print-grid">
        <span style={{ background: '#F3F4F6' }} />
        {DAYS.map((d) => (
          <b key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: '#F3F4F6' }}>
            {tc(`days.long.${d}`)}
          </b>
        ))}
        {grid}
      </div>

      <footer style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: '#5A6378' }}>
        <span>{groupNames.length > 0 ? t('sheet.groupNote', { groups: groupNames.join(' & ') }) : ''}</span>
        <span>
          {t('sheet.printed', { date: printedDate(lang) })} · {t('sheet.madeWith')}
        </span>
      </footer>
    </div>
  );
}
