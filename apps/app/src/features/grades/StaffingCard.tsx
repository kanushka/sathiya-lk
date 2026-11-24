// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { defaultSpecialistIds, pickName, staffingFor, type Grade, type Lang, type SchoolContext, type StaffingMode } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { Chip } from '../../ui/Chip';
import { MultiSelect } from '../../ui/MultiSelect';
import { Select } from '../../ui/Select';
import type { GradeStaffing } from './api';

const MODES: StaffingMode[] = ['classTeacherAll', 'classTeacherPlusSpecialists', 'subjectTeachers'];

export interface StaffingCardProps {
  grade: Grade;
  ctx: SchoolContext;
  readOnly: boolean;
  onChange: (staffing: GradeStaffing) => void;
}

export function StaffingCard({ grade, ctx, readOnly, onChange }: StaffingCardProps) {
  const { t, i18n } = useTranslation('grades');
  const lang = i18n.language as Lang;
  const effective = staffingFor(grade, ctx);
  const plus = effective.mode === 'classTeacherPlusSpecialists';
  const subjectName = (id: string) => {
    const s = ctx.subjects.find((x) => x.id === id);
    return s ? pickName(s, lang) : id;
  };
  const setMode = (mode: StaffingMode) => {
    if (mode !== 'classTeacherPlusSpecialists') return onChange({ mode });
    const defaults = defaultSpecialistIds(ctx);
    onChange({ mode, specialistSubjectIds: effective.specialistSubjectIds.length > 0 ? effective.specialistSubjectIds : defaults });
  };

  return (
    <section className="mb-5 rounded-[14px] border border-line-soft bg-white p-5">
      <h3 className="m-0 mb-1 text-[17px] font-bold">{t('staffing.title')}</h3>
      <p className="mb-3 text-sm text-ink-soft">{t('staffing.modeHint')}</p>
      <div className="flex flex-wrap items-start gap-4">
        <Select
          className="w-80 max-w-full"
          aria-label={t('staffing.mode')}
          value={effective.mode}
          disabled={readOnly}
          onChange={setMode}
          options={MODES.map((m) => ({ value: m, label: t(`staffing.modes.${m}`) }))}
        />
        {plus &&
          (readOnly ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {effective.specialistSubjectIds.map((id) => (
                <Chip key={id}>{subjectName(id)}</Chip>
              ))}
            </div>
          ) : (
            <MultiSelect
              className="min-w-64 max-w-md flex-1"
              aria-label={t('staffing.specialists')}
              value={effective.specialistSubjectIds}
              onChange={(ids) => onChange({ mode: effective.mode, specialistSubjectIds: ids })}
              placeholder={t('staffing.specialistsPlaceholder')}
              maxChips={Infinity}
              wrap
              getRemoveLabel={(o) => t('staffing.removeSpecialist', { name: o.label })}
              options={[
                ...ctx.subjects.map((s) => ({ value: s.id, label: pickName(s, lang) })),
                ...effective.specialistSubjectIds.filter((id) => !ctx.subjects.some((s) => s.id === id)).map((id) => ({ value: id, label: id })),
              ]}
            />
          ))}
      </div>
      {!grade.staffing && <p className="mb-0 mt-2.5 text-xs text-ink-muted">{t('staffing.defaultNote')}</p>}
    </section>
  );
}
