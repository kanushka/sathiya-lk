// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { FormError } from '../../ui/FormError';

export interface NewTemplateModalProps {
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}

export function NewTemplateModal({ onCreate, onClose }: NewTemplateModalProps) {
  const { t } = useTranslation('templates');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || name.trim() === '') return;
    setSaving(true);
    setFailed(false);
    try {
      await onCreate(name.trim());
      onClose();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      width={440}
      title={t('new.title')}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          {failed && (
            <FormError className="mr-auto">{t('page.saveFailed')}</FormError>
          )}
          <Button onClick={onClose} disabled={saving}>{t('new.cancel')}</Button>
          <Button variant="primary" type="submit" form="template-form" loading={saving} disabled={name.trim() === ''}>
            {t('new.create')}
          </Button>
        </>
      }
    >
      <form id="template-form" onSubmit={submit}>
        <Field label={t('new.name')} hint={t('new.hint')}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
      </form>
    </Modal>
  );
}
