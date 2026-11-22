// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';

export interface PublishModalProps {
  yearLabel: string;
  clashes: number;
  onPublish: () => Promise<string>;
  onClose: () => void;
}

export function PublishModal({ yearLabel, clashes, onPublish, onClose }: PublishModalProps) {
  const { t } = useTranslation('dashboard');
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (saving) return;
    setSaving(true);
    try {
      toast.show(await onPublish(), 'success');
      onClose();
    } catch {
      toast.show(t('publish.failed'), 'error');
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      width={460}
      title={t('publish.title', { year: yearLabel })}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>{t('publish.cancel')}</Button>
          <Button variant="primary" onClick={() => void confirm()} loading={saving} loadingLabel={t('busy.publishing', { ns: 'common' })}>
            {t('publish.confirm')}
          </Button>
        </>
      }
    >
      <p className="m-0 text-sm text-ink-soft">{t('publish.body')}</p>
      {clashes > 0 && <p className="mb-0 mt-3 text-sm font-semibold text-danger">{t('publish.clashes', { n: clashes })}</p>}
    </Modal>
  );
}
