// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';

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
      footer={
        <>
          {failed && (
            <p role="alert" className="mr-auto text-sm font-medium text-[#A3262A]">
              {t('page.saveFailed')}
            </p>
          )}
          <Button onClick={onClose}>{t('new.cancel')}</Button>
          <Button variant="primary" type="submit" form="template-form" disabled={saving || name.trim() === ''}>
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
