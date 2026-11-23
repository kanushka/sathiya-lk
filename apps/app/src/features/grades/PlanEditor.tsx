// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type Lang, type PlanItem, type Subject } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { cx } from '../../ui/cx';
import { LinkButton } from '../../ui/LinkButton';
import { useAdminBase } from '../timetable/paths';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { inputBareCompactClass } from '../../ui/Field';
import { IconButton } from '../../ui/IconButton';
import { MultiSelect } from '../../ui/MultiSelect';
import { Select } from '../../ui/Select';
import { GroupModal } from './GroupModal';
import { newGroupKey, planFit, planTotal, type PlanCapacity, type PlanFit } from './planModel';

type Group = Extract<PlanItem, { kind: 'group' }>;

export interface PlanEditorProps {
  plan: PlanItem[];
  capacity: PlanCapacity;
  subjects: Subject[];
  readOnly: boolean;
  onChange: (plan: PlanItem[]) => void;
}

function PerWeekInput({ label, value, disabled, onCommit }: { label: string; value: number; disabled: boolean; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (!/^\d+$/.test(text)) return;
    const n = Number(text);
    if (n !== value) onCommit(n);
  }

  return (
    <input
      type="number"
      min={0}
      aria-label={label}
      value={draft ?? value}
      disabled={disabled}
      className={cx(inputBareCompactClass, 'h-9 w-14 text-center font-bold')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}

const fitColor: Record<PlanFit, string> = {
  exact: 'text-success',
  under: 'text-warning',
  mixed: 'text-warning',
  over: 'text-danger',
};

export function PlanEditor({ plan, capacity, subjects, readOnly, onChange }: PlanEditorProps) {
  const base = useAdminBase();
  const { t, i18n } = useTranslation('grades');
  const lang = i18n.language as Lang;
  const [dialog, setDialog] = useState<{ index: number | null } | null>(null);
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const subjectName = (id: string) => (byId.get(id) ? pickName(byId.get(id)!, lang) : id);
  const total = planTotal(plan);
  const fit = planFit(total, capacity);
  const usedSubjects = new Set(plan.flatMap((p) => (p.kind === 'subject' ? [p.subjectId] : [])));
  const unused = subjects.filter((s) => !usedSubjects.has(s.id)).sort((a, b) => pickName(a, lang).localeCompare(pickName(b, lang)));

  const replace = (i: number, item: PlanItem) => onChange(plan.map((p, j) => (j === i ? item : p)));
  const remove = (i: number) => onChange(plan.filter((_, j) => j !== i));
  const setGroupOptions = (i: number, g: Group, ids: string[]) => replace(i, { ...g, optionSubjectIds: ids });
  const itemName = (p: PlanItem) => (p.kind === 'subject' ? subjectName(p.subjectId) : pickName(p, lang));

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-end justify-between gap-3">
        <h3 className="m-0 text-[17px] font-bold">{t('plan.title')}</h3>
        <p className="m-0 text-sm">
          <b data-testid="plan-total" data-fit={fit} className={`text-lg ${fitColor[fit]}`}>
            {total} / {capacity.min === capacity.max ? capacity.max : `${capacity.min}–${capacity.max}`}
          </b>{' '}
          {t('plan.periodsInWeek')}
        </p>
      </div>
      <p className="mb-4 text-sm text-ink-soft">{t('plan.intro')}</p>

      <div className="overflow-hidden rounded-xl border border-line-soft">
        {plan.length === 0 && <p className="px-3.5 py-4 text-sm text-ink-muted">{t('plan.empty')}</p>}
        {plan.map((p, i) => {
          const subject = p.kind === 'subject' ? byId.get(p.subjectId) : undefined;
          const name = itemName(p);
          return (
            <div
              key={p.kind === 'group' ? `g:${p.key}` : `s:${p.subjectId}`}
              className={`flex items-center gap-3.5 border-b border-line-soft px-3.5 py-2.5 ${p.kind === 'group' ? 'bg-warning-soft/40' : ''}`}
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: subject?.color ?? '#FBEAC9' }} />
              <div className="min-w-0 flex-1">
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
              <PerWeekInput
                label={t('plan.perWeekFor', { name })}
                value={p.perWeek}
                disabled={readOnly}
                onCommit={(perWeek) => replace(i, { ...p, perWeek })}
              />
              <span className="w-16 text-[13px] text-ink-soft">{t('plan.perWeek')}</span>
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
                className="w-56"
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
