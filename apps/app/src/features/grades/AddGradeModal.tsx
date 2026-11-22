// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { NativeSelect } from '../../ui/NativeSelect';

export interface AddGradeModalProps {
  choices: number[];
  onAdd: (n: number) => Promise<void>;
  onClose: () => void;
}

export function AddGradeModal({ choices, onAdd, onClose }: AddGradeModalProps) {
  const { t } = useTranslation('grades');
  const [value, setValue] = useState(choices[0] ?? 0);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    await onAdd(value);
    onClose();
  }

  return (
    <Modal
      open
      width={420}
      title={t('addGrade.title')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('addGrade.cancel')}</Button>
          <Button variant="primary" type="submit" form="grade-form" disabled={saving}>
            {t('addGrade.add')}
          </Button>
        </>
      }
    >
      <form id="grade-form" onSubmit={submit}>
        <Field label={t('addGrade.number')}>
          <NativeSelect value={value} onChange={(e) => setValue(Number(e.target.value))}>
            {choices.map((n) => (
              <option key={n} value={n}>
                {t('rail.grade', { n })}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </form>
    </Modal>
  );
}
