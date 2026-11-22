// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { classProgress, effectivePlan, weekCapacity, windowOf, type Entry, type SchoolClass } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { cx } from '../../ui/cx';
import { IconButton } from '../../ui/IconButton';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { planItemColor, planItemName } from './labels';

export interface SubjectProgressProps {
  cls: SchoolClass;
  entries: Entry[];
  onPin?(subjectId: string): void;
  onStop?(): void;
  activeSubjectId?: string;
}

export function SubjectProgress({ cls, entries, onPin, onStop, activeSubjectId }: SubjectProgressProps) {
  const { t } = useTranslation('timetable');
  const { lang } = useLang();
  const ctx = useSchool();
  const grade = ctx.grades.find((g) => g.id === cls.gradeId);
  const template = ctx.templates.find((x) => x.id === cls.templateId);
  const rows = grade ? classProgress(cls.id, entries, effectivePlan(cls, grade)) : [];
  const total = template ? weekCapacity(template) : 0;
  const placed = template
    ? entries.filter((e) => e.classIds.includes(cls.id) && windowOf(template, e.day, e.period) !== null).length
    : 0;

  return (
    <section className="rounded-[14px] border border-line bg-white p-4">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="m-0 text-[15px] font-bold">{t('progress.title', { class: cls.name })}</h2>
        <span className="text-[13px] text-ink-muted">
          <b className="text-ink">{placed}</b> <span>{t('progress.placedOf', { total })}</span>
        </span>
      </div>
      <ul className="m-0 list-none p-0">
        {rows.map((r) => {
          const done = r.placed >= r.needed;
          const over = r.placed > r.needed;
          const pct = r.needed > 0 ? Math.min(100, Math.round((r.placed / r.needed) * 100)) : 100;
          const subjectId = r.item.kind === 'subject' ? r.item.subjectId : null;
          const active = subjectId !== null && subjectId === activeSubjectId;
          const name = planItemName(r.item, ctx, lang);
          return (
            <li
              key={r.key}
              data-active={active || undefined}
              className={cx('-mx-2 flex items-center gap-2.5 rounded-[10px] px-2 py-[5px]', active && 'bg-brand/10 shadow-[inset_0_0_0_1.5px_var(--brand)]')}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: planItemColor(r.item, ctx) }} />
              <span className="flex-1 text-[13px]">{name}</span>
              <span className="h-1.5 w-[70px] overflow-hidden rounded-full bg-[#EEF0F3]" aria-hidden="true">
                <span data-bar className="block h-1.5" style={{ width: `${pct}%`, background: over ? '#B3261E' : done ? '#2E8B4A' : '#D9A441' }} />
              </span>
              <b data-over={over || undefined} className="w-9 text-right text-[13px]" style={{ color: over ? '#B3261E' : done ? '#1F6B34' : '#7A5410' }}>
                {t('progress.count', { placed: r.placed, needed: r.needed })}
              </b>
              {onPin && (
                <span className="flex w-9 shrink-0 justify-end">
                  {subjectId !== null && (
                    <IconButton
                      data-pin-subject={subjectId}
                      icon={active ? 'check' : 'pin'}
                      label={active ? t('pin.listStop', { subject: name }) : t('pin.listPin', { subject: name })}
                      variant={active ? 'primary' : 'secondary'}
                      size="sm"
                      pressed={active}
                      onClick={() => (active ? onStop?.() : onPin(subjectId))}
                    />
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
