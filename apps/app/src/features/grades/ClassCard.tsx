// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { teacherDisplayName, weekCapacity, type PeriodTemplate, type SchoolClass, type Teacher } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { Button } from '../../ui/Button';
import { NativeSelect } from '../../ui/NativeSelect';

export interface ClassCardProps {
  cls: SchoolClass;
  teachers: Teacher[];
  templates: PeriodTemplate[];
  readOnly: boolean;
  onTeacher: (teacherId: string | null) => void;
  onTemplate: (templateId: string) => void;
  onCustomPlan: () => void;
  onRemove: () => void;
}

export function ClassCard({ cls, teachers, templates, readOnly, onTeacher, onTemplate, onCustomPlan, onRemove }: ClassCardProps) {
  const { t } = useTranslation('grades');
  const { lang } = useLang();
  const label = 'mb-1 mt-2.5 block text-xs font-semibold text-ink-soft';
  return (
    <div data-testid="class-card" className="rounded-xl border border-line-soft p-3.5">
      <div className="flex items-center justify-between">
        <strong className="text-xl">{cls.name}</strong>
        {!readOnly && (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            {t('classes.remove')}
          </Button>
        )}
      </div>
      <label className={label}>
        {t('classes.teacher')}
        <NativeSelect
          className="mt-1 font-normal"
          disabled={readOnly}
          value={cls.classTeacherId ?? ''}
          onChange={(e) => onTeacher(e.target.value || null)}
        >
          <option value="">{t('classes.noTeacher')}</option>
          {teachers.map((x) => (
            <option key={x.id} value={x.id}>
              {teacherDisplayName(x, lang)}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className={label}>
        {t('classes.template')}
        <NativeSelect className="mt-1 font-normal" disabled={readOnly} value={cls.templateId} onChange={(e) => onTemplate(e.target.value)}>
          {templates.map((x) => (
            <option key={x.id} value={x.id}>
              {t('classes.templateOption', { name: x.name, count: weekCapacity(x) })}
            </option>
          ))}
        </NativeSelect>
      </label>
      <div className="mt-3 flex items-center gap-2">
        {!readOnly && (
          <Button size="sm" onClick={onCustomPlan}>
            {t('classes.customPlan')}
          </Button>
        )}
        {cls.planOverride && (
          <span className="rounded-full bg-[#FBF1DC] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#7A5410]">
            {t('classes.ownPlan')}
          </span>
        )}
      </div>
    </div>
  );
}
