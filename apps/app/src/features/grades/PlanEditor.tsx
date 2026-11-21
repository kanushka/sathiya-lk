// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type Lang, type PlanItem, type Subject } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { GroupModal } from './GroupModal';
import { newGroupKey, planTotal } from './planModel';

type Group = Extract<PlanItem, { kind: 'group' }>;

export interface PlanEditorProps {
  plan: PlanItem[];
  capacity: number;
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
      className="h-9 w-14 rounded-lg border border-line-strong text-center text-[15px] font-bold disabled:bg-slate-50"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}

const linkBtn = 'border-0 bg-transparent text-sm font-semibold text-brand hover:underline';

export function PlanEditor({ plan, capacity, subjects, readOnly, onChange }: PlanEditorProps) {
  const { t, i18n } = useTranslation('grades');
  const lang = i18n.language as Lang;
  const [dialog, setDialog] = useState<{ index: number | null } | null>(null);
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const subjectName = (id: string) => (byId.get(id) ? pickName(byId.get(id)!, lang) : id);
  const total = planTotal(plan);
  const usedSubjects = new Set(plan.flatMap((p) => (p.kind === 'subject' ? [p.subjectId] : [])));
  const unused = subjects.filter((s) => !usedSubjects.has(s.id)).sort((a, b) => a.nameEn.localeCompare(b.nameEn));

  const replace = (i: number, item: PlanItem) => onChange(plan.map((p, j) => (j === i ? item : p)));
  const remove = (i: number) => onChange(plan.filter((_, j) => j !== i));
  const setGroupOptions = (i: number, g: Group, ids: string[]) => replace(i, { ...g, optionSubjectIds: ids });
  const itemName = (p: PlanItem) => (p.kind === 'subject' ? subjectName(p.subjectId) : pickName(p, lang));

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="m-0 text-[17px] font-bold">{t('plan.title')}</h2>
        <p className="m-0 text-sm">
          <b data-testid="plan-total" className={`text-lg ${total > capacity ? 'text-danger' : 'text-[#1F6B34]'}`}>
            {total} / {capacity}
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
              className={`flex items-center gap-3.5 border-b border-line-soft px-3.5 py-2.5 ${p.kind === 'group' ? 'bg-[#FFFCF5]' : ''}`}
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: subject?.color ?? '#FBEAC9' }} />
              <div className="min-w-0 flex-1">
                <strong className="text-sm">{name}</strong>
                {p.kind === 'group' && (
                  <>
                    <span className="ml-2 rounded-full bg-[#FBF1DC] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#7A5410]">
                      {t('plan.group')}
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {p.optionSubjectIds.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white px-2.5 py-1 text-[13px]">
                          {subjectName(id)}
                          {!readOnly && (
                            <button
                              type="button"
                              aria-label={t('plan.removeOption', { name: subjectName(id), group: name })}
                              className="text-ink-muted hover:text-ink"
                              onClick={() => setGroupOptions(i, p, p.optionSubjectIds.filter((o) => o !== id))}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                      {!readOnly && subjects.some((s) => !p.optionSubjectIds.includes(s.id)) && (
                        <Select
                          className="w-40"
                          aria-label={t('plan.addOption', { group: name })}
                          value=""
                          onChange={(e) => e.target.value && setGroupOptions(i, p, [...p.optionSubjectIds, e.target.value])}
                        >
                          <option value="">{t('plan.optionPlaceholder')}</option>
                          {subjects
                            .filter((s) => !p.optionSubjectIds.includes(s.id))
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {pickName(s, lang)}
                              </option>
                            ))}
                        </Select>
                      )}
                    </div>
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
                  <Button size="sm" variant="ghost" aria-label={t('plan.removeItem', { name })} onClick={() => remove(i)}>
                    ×
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-4 bg-[#FAFAFB] px-3.5 py-3">
            {unused.length > 0 && (
              <Select
                className="w-56"
                aria-label={t('plan.addSubject')}
                value=""
                onChange={(e) => e.target.value && onChange([...plan, { kind: 'subject', subjectId: e.target.value, perWeek: 1 }])}
              >
                <option value="">{t('plan.addSubject')}</option>
                {unused.map((s) => (
                  <option key={s.id} value={s.id}>
                    {pickName(s, lang)}
                  </option>
                ))}
              </Select>
            )}
            <button type="button" className={linkBtn} onClick={() => setDialog({ index: null })}>
              {t('plan.addGroup')}
            </button>
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
