// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';

export interface NewYearModalProps {
  onCreate: (label: string) => Promise<void>;
  onClose: () => void;
}

export function NewYearModal({ onCreate, onClose }: NewYearModalProps) {
  const { t } = useTranslation('dashboard');
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || label.trim() === '') return;
    setSaving(true);
    try {
      await onCreate(label.trim());
      toast.show(t('year.created'), 'success');
      onClose();
    } catch {
      toast.show(t('year.createFailed'), 'error');
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      width={440}
      title={t('year.newTitle')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('year.cancel')}</Button>
          <Button variant="primary" type="submit" form="year-form" disabled={saving || label.trim() === ''}>
            {t('year.create')}
          </Button>
        </>
      }
    >
      <form id="year-form" onSubmit={submit}>
        <Field label={t('year.label')} hint={t('year.labelHint')}>
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        </Field>
      </form>
    </Modal>
  );
}
