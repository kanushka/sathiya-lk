// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type Lang, type PlanItem, type Subject } from '@sathiya/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { NameFields } from '../../ui/NameFields';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { AmountEditor } from './AmountEditor';
import { applyAmount, type Amount } from './planModel';
import { MultiSelect } from '../../ui/MultiSelect';
import { Modal } from '../../ui/Modal';

type Group = Extract<PlanItem, { kind: 'group' }>;

export interface GroupModalProps {
  initial?: Group;
  subjects: Subject[];
  newKey: () => string;
  onSave: (group: Group) => void;
  onClose: () => void;
}

export function GroupModal({ initial, subjects, newKey, onSave, onClose }: GroupModalProps) {
  const { t, i18n } = useTranslation('grades');
  const lang = i18n.language as Lang;
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '');
  const [nameSi, setNameSi] = useState(initial?.nameSi ?? '');
  const [amount, setAmount] = useState<Amount>({
    perWeek: initial?.perWeek ?? 1,
    ...(initial?.unit === 'minutes' ? { unit: 'minutes' as const } : {}),
    ...(initial?.perDay !== undefined ? { perDay: initial.perDay } : {}),
  });
  const [options, setOptions] = useState<string[]>(initial?.optionSubjectIds ?? []);
  const [submitted, setSubmitted] = useState(false);

  const byId = new Map(subjects.map((s) => [s.id, s]));
  const nameError = nameEn.trim() || nameSi.trim() ? null : t('common:names.missing');
  const optionsError = options.length > 0 ? null : t('group.errors.options');

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (nameError || optionsError) return;
    const group: Group = {
      kind: 'group',
      key: initial?.key ?? newKey(),
      nameEn: nameEn.trim(),
      ...(nameSi.trim() ? { nameSi: nameSi.trim() } : {}),
      optionSubjectIds: options,
      perWeek: amount.perWeek,
    };
    onSave(applyAmount(group, amount) as Group);
  }

  return (
    <Modal
      open
      width={560}
      title={initial ? t('group.editTitle') : t('group.addTitle')}
      subtitle={t('group.subtitle')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('group.cancel')}</Button>
          <Button variant="primary" type="submit" form="group-form">
            {initial ? t('group.save') : t('group.add')}
          </Button>
        </>
      }
    >
      <form id="group-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <NameFields legend={t('group.name')} enLabel={t('group.nameEn')} siLabel={t('group.nameSi')} en={nameEn} si={nameSi} onEn={setNameEn} onSi={setNameSi} missing={submitted && !!nameError} />
        <div role="group" aria-labelledby="group-target" className="flex flex-col gap-1.5">
          <span id="group-target" className="text-[13px] font-semibold text-ink">
            {t('group.target')}
          </span>
          <AmountEditor item={amount} disabled={false} onChange={setAmount} />
        </div>
        <Field label={t('group.options')} error={submitted ? optionsError : null}>
          <MultiSelect
            value={options}
            onChange={setOptions}
            placeholder={t('group.addOptionPlaceholder')}
            maxChips={Infinity}
            wrap
            getRemoveLabel={(o) => t('group.removeOption', { name: o.label })}
            options={[
              ...subjects.map((s) => ({ value: s.id, label: pickName(s, lang) })),
              ...options.filter((id) => !byId.has(id)).map((id) => ({ value: id, label: id })),
            ]}
          />
        </Field>
      </form>
    </Modal>
  );
}
