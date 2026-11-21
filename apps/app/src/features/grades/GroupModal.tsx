// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type Lang, type PlanItem, type Subject } from '@sathiya/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { Select } from '../../ui/Select';

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
  const [perWeek, setPerWeek] = useState(initial?.perWeek ?? 1);
  const [options, setOptions] = useState<string[]>(initial?.optionSubjectIds ?? []);
  const [submitted, setSubmitted] = useState(false);

  const byId = new Map(subjects.map((s) => [s.id, s]));
  const available = subjects.filter((s) => !options.includes(s.id));
  const nameError = nameEn.trim() ? null : t('group.errors.name');
  const optionsError = options.length > 0 ? null : t('group.errors.options');

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (nameError || optionsError) return;
    onSave({
      kind: 'group',
      key: initial?.key ?? newKey(),
      nameEn: nameEn.trim(),
      ...(nameSi.trim() ? { nameSi: nameSi.trim() } : {}),
      optionSubjectIds: options,
      perWeek,
    });
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
        <Field label={t('group.nameEn')} error={submitted ? nameError : null}>
          <input className={inputClass} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </Field>
        <Field label={t('group.nameSi')} hint={t('group.nameSiHint')}>
          <input className={inputClass} value={nameSi} onChange={(e) => setNameSi(e.target.value)} />
        </Field>
        <Field label={t('group.perWeek')} className="w-40">
          <input
            className={inputClass}
            type="number"
            min={0}
            value={perWeek}
            onChange={(e) => setPerWeek(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">{t('group.options')}</p>
          <div className="flex flex-wrap gap-1.5">
            {options.map((id) => {
              const name = byId.get(id) ? pickName(byId.get(id)!, lang) : id;
              return (
                <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white px-2.5 py-1 text-[13px]">
                  {name}
                  <button
                    type="button"
                    aria-label={t('group.removeOption', { name })}
                    className="text-ink-muted hover:text-ink"
                    onClick={() => setOptions(options.filter((o) => o !== id))}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
          {available.length > 0 && (
            <Select
              className="mt-2 w-60"
              aria-label={t('group.addOption')}
              value=""
              onChange={(e) => e.target.value && setOptions([...options, e.target.value])}
            >
              <option value="">{t('group.addOptionPlaceholder')}</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {pickName(s, lang)}
                </option>
              ))}
            </Select>
          )}
          {submitted && optionsError && (
            <p role="alert" className="mt-1 text-xs font-medium text-[#A3262A]">
              {optionsError}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
