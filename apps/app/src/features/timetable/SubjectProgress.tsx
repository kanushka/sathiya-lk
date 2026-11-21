import { classProgress, effectivePlan, weekCapacity, windowOf, type Entry, type SchoolClass } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { planItemColor, planItemName } from './labels';

export interface SubjectProgressProps {
  cls: SchoolClass;
  entries: Entry[];
}

export function SubjectProgress({ cls, entries }: SubjectProgressProps) {
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
          const pct = r.needed > 0 ? Math.min(100, Math.round((r.placed / r.needed) * 100)) : 100;
          return (
            <li key={r.key} className="flex items-center gap-2.5 py-[5px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: planItemColor(r.item, ctx) }} />
              <span className="flex-1 text-[13px]">{planItemName(r.item, ctx, lang)}</span>
              <span className="h-1.5 w-[70px] overflow-hidden rounded-full bg-[#EEF0F3]" aria-hidden="true">
                <span data-bar className="block h-1.5" style={{ width: `${pct}%`, background: done ? '#2E8B4A' : '#D9A441' }} />
              </span>
              <b className="w-9 text-right text-[13px]" style={{ color: done ? '#1F6B34' : '#7A5410' }}>
                {t('progress.count', { placed: r.placed, needed: r.needed })}
              </b>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
