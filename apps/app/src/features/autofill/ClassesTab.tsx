// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { effectivePlan, periodsFor, rowsFor, type DayIndex, type Entry, type Lang, type SchoolClass, type SchoolContext, type TemplateRow } from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { Select } from '../../ui/Select';
import { CellBody } from '../timetable/Cell';
import { sortedClasses } from '../timetable/ClassViewPage';
import { classCellView } from '../timetable/labels';
import { TimetableGrid, type GridOverlay, type Slot } from '../timetable/TimetableGrid';

const DAYS: DayIndex[] = [0, 1, 2, 3, 4];

function ClassGrid({ cls, ctx, kept, added, lang }: { cls: SchoolClass; ctx: SchoolContext; kept: Entry[]; added: Entry[]; lang: Lang }) {
  const { t } = useTranslation('autofill');
  const { t: tt } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const [selected, setSelected] = useState<Slot | undefined>();
  const template = ctx.templates.find((x) => x.id === cls.templateId);
  const grade = ctx.grades.find((g) => g.id === cls.gradeId);
  const plan = grade ? effectivePlan(cls, grade) : [];
  const rows = useMemo(
    () => (template ? (Object.fromEntries(DAYS.map((d) => [d, rowsFor(template, d)])) as Record<DayIndex, TemplateRow[]>) : null),
    [template],
  );
  const index = useMemo(() => {
    const bySlot = (list: Entry[]) => new Map(list.filter((e) => e.classIds.includes(cls.id)).map((e) => [`${e.day}|${e.period}`, e]));
    return { kept: bySlot(kept), added: bySlot(added) };
  }, [kept, added, cls.id]);
  if (!template || !rows) return null;

  const overlay = (day: DayIndex, period: number): GridOverlay | null => {
    const e = index.added.get(`${day}|${period}`);
    const time = periodsFor(template, day).find((p) => p.period === period);
    if (!e || !time) return null;
    const view = classCellView(e, ctx, lang, tt, plan);
    return {
      label: t('classes.newCell', { title: view.title, sub: view.sub, day: tc(`days.long.${day}`), n: period, time: `${time.start}–${time.end}` }),
      className: 'border-2 border-brand text-ink',
      content: <CellBody cells={[view]} readOnly />,
    };
  };

  return (
    <TimetableGrid
      rows={rows}
      cellsFor={(d, p) => {
        const e = index.kept.get(`${d}|${p}`);
        return e ? classCellView(e, ctx, lang, tt, plan) : null;
      }}
      selected={selected}
      onSelect={(day, period) => setSelected({ day, period })}
      readOnly
      overlay={overlay}
    />
  );
}

export function ClassesTab({ ctx, kept, added, classIds, lang }: { ctx: SchoolContext; kept: Entry[]; added: Entry[]; classIds: string[]; lang: Lang }) {
  const { t } = useTranslation('autofill');
  const { t: tt } = useTranslation('timetable');
  const isPhone = useMediaQuery(PHONE_QUERY);
  const classes = useMemo(() => sortedClasses(ctx).filter((c) => classIds.includes(c.id)), [ctx, classIds]);
  const [picked, setPicked] = useState<string | undefined>();
  if (classes.length === 0) return <p className="m-0 text-sm text-ink-soft">{t('classes.empty')}</p>;
  const label = (c: SchoolClass) => tt('classView.classOption', { grade: ctx.grades.find((g) => g.id === c.gradeId)?.number ?? '', name: c.name });
  const shown = isPhone ? [classes.find((c) => c.id === picked) ?? classes[0]!] : classes;

  return (
    <div>
      <p className="m-0 mb-3 text-sm text-ink-soft">{t('classes.legend')}</p>
      {isPhone && (
        <Select
          aria-label={t('classes.pick')}
          value={shown[0]!.id}
          onChange={setPicked}
          options={classes.map((c) => ({ value: c.id, label: label(c) }))}
          className="mb-4 w-full"
        />
      )}
      {shown.map((cls) => (
        <section key={cls.id} className="mb-6">
          {!isPhone && <h3 className="mb-2 text-sm font-bold text-ink">{label(cls)}</h3>}
          <ClassGrid cls={cls} ctx={ctx} kept={kept} added={added} lang={lang} />
        </section>
      ))}
    </div>
  );
}
