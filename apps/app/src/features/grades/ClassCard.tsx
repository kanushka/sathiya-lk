// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { teacherDisplayName, weekCapacity, type PeriodTemplate, type SchoolClass, type Teacher } from '@sathiya/core';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';

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
  const teacherId = useId();
  const templateId = useId();
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
      <label htmlFor={teacherId} className={label}>
        {t('classes.teacher')}
      </label>
      <Select
        id={teacherId}
        disabled={readOnly}
        value={cls.classTeacherId ?? ''}
        onChange={(v) => onTeacher(v || null)}
        options={[
          { value: '', label: t('classes.noTeacher') },
          ...teachers.map((x) => ({ value: x.id, label: teacherDisplayName(x, lang) })),
        ]}
      />
      <label htmlFor={templateId} className={label}>
        {t('classes.template')}
      </label>
      <Select
        id={templateId}
        disabled={readOnly}
        value={cls.templateId}
        onChange={onTemplate}
        options={templates.map((x) => ({
          value: x.id,
          label: t('classes.templateOption', { name: x.name, count: weekCapacity(x) }),
        }))}
      />
      <div className="mt-3 flex items-center gap-2">
        {!readOnly && (
          <Button size="sm" onClick={onCustomPlan}>
            {t('classes.customPlan')}
          </Button>
        )}
        {cls.planOverride && (
          <Badge tone="warning" className="uppercase tracking-wide">
            {t('classes.ownPlan')}
          </Badge>
        )}
      </div>
    </div>
  );
}
