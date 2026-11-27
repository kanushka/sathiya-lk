// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { formatAmount, pickName, type Lang, type PlanItem, type Subject } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { LinkButton } from '../../ui/LinkButton';
import { useAdminBase } from '../timetable/paths';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { IconButton } from '../../ui/IconButton';
import { MultiSelect } from '../../ui/MultiSelect';
import { Select } from '../../ui/Select';
import { GroupModal } from './GroupModal';
import { AmountEditor } from './AmountEditor';
import { applyAmount, newGroupKey, planFit, planMinutes, planTotal, type PlanCapacity, type PlanFit } from './planModel';

type Group = Extract<PlanItem, { kind: 'group' }>;

export interface PlanEditorProps {
  plan: PlanItem[];
  capacity: PlanCapacity;
  subjects: Subject[];
  readOnly: boolean;
  onChange: (plan: PlanItem[]) => void;
  /** Phone layout: each subject on one line, group options as chips with Edit. */
  compact?: boolean;
}

const fitColor: Record<PlanFit, string> = {
  exact: 'text-success',
  under: 'text-warning',
  mixed: 'text-warning',
  over: 'text-danger',
};

export function PlanEditor({ plan, capacity, subjects, readOnly, onChange, compact = false }: PlanEditorProps) {
  const base = useAdminBase();
  const { t, i18n } = useTranslation('grades');
  const lang = i18n.language as Lang;
  const [dialog, setDialog] = useState<{ index: number | null } | null>(null);
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const subjectName = (id: string) => (byId.get(id) ? pickName(byId.get(id)!, lang) : id);
  const total = planTotal(plan);
  const timed = planMinutes(plan);
  const fit = planFit(total, capacity);
  const showPeriods = total > 0 || timed === 0;
  const usedSubjects = new Set(plan.flatMap((p) => (p.kind === 'subject' ? [p.subjectId] : [])));
  const unused = subjects.filter((s) => !usedSubjects.has(s.id)).sort((a, b) => pickName(a, lang).localeCompare(pickName(b, lang)));

  const replace = (i: number, item: PlanItem) => onChange(plan.map((p, j) => (j === i ? item : p)));
  const remove = (i: number) => onChange(plan.filter((_, j) => j !== i));
  const setGroupOptions = (i: number, g: Group, ids: string[]) => replace(i, { ...g, optionSubjectIds: ids });
  const itemName = (p: PlanItem) => (p.kind === 'subject' ? subjectName(p.subjectId) : pickName(p, lang));

  return (
    <div>
      <div className={compact ? 'px-4 pb-3 pt-4' : 'mb-1.5 flex flex-wrap items-end justify-between gap-3'}>
        <h3 className={compact ? 'm-0 text-[15px] font-bold' : 'm-0 text-[17px] font-bold'}>{t('plan.title')}</h3>
        <p className="m-0 text-sm">
          {showPeriods && (
            <>
              <b data-testid="plan-total" data-fit={fit} className={`text-lg ${fitColor[fit]}`}>
                {total} / {capacity.min === capacity.max ? capacity.max : `${capacity.min}–${capacity.max}`}
              </b>{' '}
              {t('plan.periodsInWeek')}
            </>
          )}
          {timed > 0 && <span className={showPeriods ? 'ml-1.5 text-ink-soft' : 'text-ink-soft'} data-testid="plan-timed">{t(showPeriods ? 'plan.timedTotal' : 'plan.timedOnly', { amount: formatAmount(timed, 'minutes', lang) })}</span>}
        </p>
      </div>
      {!compact && <p className="mb-4 text-sm text-ink-soft">{t('plan.intro')}</p>}

      <div className={compact ? 'border-t border-line-soft' : 'overflow-hidden rounded-xl border border-line-soft'}>
        {plan.length === 0 && <p className="px-3.5 py-4 text-sm text-ink-muted">{t('plan.empty')}</p>}
        {plan.map((p, i) => {
          const subject = p.kind === 'subject' ? byId.get(p.subjectId) : undefined;
          const name = itemName(p);
          if (compact) {
            return (
              <div
                key={p.kind === 'group' ? `g:${p.key}` : `s:${p.subjectId}`}
                className={`border-b border-line-soft py-1.5 pl-2.5 pr-0 ${p.kind === 'group' ? 'bg-warning-soft/40' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                  <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: subject?.color ?? '#FBEAC9' }} />
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[13px] leading-tight [overflow-wrap:break-word]">{name}</strong>
                    {p.kind === 'group' && (
                      <Badge tone="warning" className="mt-0.5 uppercase tracking-wide">
                        {t('plan.group')}
                      </Badge>
                    )}
                  </span>
                  <AmountEditor item={p} name={name} disabled={readOnly} compact onChange={(next) => replace(i, applyAmount(p, next))} />
                  {!readOnly && <IconButton icon="close" label={t('plan.removeItem', { name })} className="h-11 w-11" onClick={() => remove(i)} />}
                </div>
                {p.kind === 'group' && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
                    {p.optionSubjectIds.map((id) => (
                      <Chip key={id}>{subjectName(id)}</Chip>
                    ))}
                    {!readOnly && (
                      <Button variant="link" className="min-h-11 px-1" onClick={() => setDialog({ index: i })}>
                        {t('plan.editGroup')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          }
          return (
            <div
              key={p.kind === 'group' ? `g:${p.key}` : `s:${p.subjectId}`}
              className={`flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-line-soft px-3.5 py-2.5 ${p.kind === 'group' ? 'bg-warning-soft/40' : ''}`}
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: subject?.color ?? '#FBEAC9' }} />
              <div className="min-w-0 flex-1 basis-[calc(100%-2rem)] md:basis-auto">
                <strong className="text-sm">{name}</strong>
                {p.kind === 'group' && (
                  <>
                    <Badge tone="warning" className="ml-2 uppercase tracking-wide">
                      {t('plan.group')}
                    </Badge>
                    {readOnly ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {p.optionSubjectIds.map((id) => (
                          <Chip key={id}>{subjectName(id)}</Chip>
                        ))}
                      </div>
                    ) : (
                      <MultiSelect
                        className="mt-2 max-w-md"
                        aria-label={t('plan.addOption', { group: name })}
                        value={p.optionSubjectIds}
                        onChange={(ids) => setGroupOptions(i, p, ids)}
                        placeholder={t('plan.optionPlaceholder')}
                        maxChips={Infinity}
                        wrap
                        getRemoveLabel={(o) => t('plan.removeOption', { name: o.label, group: name })}
                        options={[
                          ...subjects.map((s) => ({ value: s.id, label: pickName(s, lang) })),
                          ...p.optionSubjectIds.filter((id) => !byId.has(id)).map((id) => ({ value: id, label: id })),
                        ]}
                      />
                    )}
                  </>
                )}
              </div>
              <AmountEditor item={p} name={name} disabled={readOnly} onChange={(next) => replace(i, applyAmount(p, next))} />
              {!readOnly && (
                <div className="flex gap-1">
                  {p.kind === 'group' && (
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ index: i })}>
                      {t('plan.editGroup')}
                    </Button>
                  )}
                  <IconButton icon="close" size="sm" label={t('plan.removeItem', { name })} onClick={() => remove(i)} />
                </div>
              )}
            </div>
          );
        })}
        {!readOnly && subjects.length === 0 && (
          <p className="flex flex-wrap items-center gap-3 px-3.5 py-3 text-sm text-ink-muted">
            {t('plan.noSubjects')}
            <LinkButton variant="primary" size="sm" to={`${base}/subjects`}>
              {t('plan.goSubjects')}
            </LinkButton>
          </p>
        )}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-4 bg-surface px-3.5 py-3">
            {unused.length > 0 && (
              <Select
                className={compact ? 'min-w-0 flex-1' : 'w-56'}
                aria-label={t('plan.addSubject')}
                value=""
                placeholder={t('plan.addSubject')}
                onChange={(subjectId) => onChange([...plan, { kind: 'subject', subjectId, perWeek: 1 }])}
                options={unused.map((s) => ({ value: s.id, label: pickName(s, lang) }))}
              />
            )}
            <Button variant="link" onClick={() => setDialog({ index: null })}>
              {t('plan.addGroup')}
            </Button>
          </div>
        )}
      </div>

      {dialog && (
        <GroupModal
          initial={dialog.index !== null ? (plan[dialog.index] as Group) : undefined}
          subjects={subjects}
          newKey={() => newGroupKey(plan)}
          onClose={() => setDialog(null)}
          onSave={(g) => {
            onChange(dialog.index !== null ? plan.map((p, j) => (j === dialog.index ? g : p)) : [...plan, g]);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
