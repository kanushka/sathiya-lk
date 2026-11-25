// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Modal } from '../../ui/Modal';

export interface RemoveAdminModalProps {
  name: string;
  self: boolean;
  teacher: boolean;
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
}

export function RemoveAdminModal({ name, self, teacher, onConfirm, onClose }: RemoveAdminModalProps) {
  const { t } = useTranslation('members');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const failure = await onConfirm();
    setBusy(false);
    if (failure) setError(failure);
    else onClose();
  }

  return (
    <Modal
      open
      width={460}
      title={t('remove.title', { name })}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('remove.cancel')}
          </Button>
          <Button variant="dangerSolid" loading={busy} onClick={() => void confirm()}>
            {t('remove.confirm')}
          </Button>
        </>
      }
    >
      <p className="m-0 text-sm text-ink-soft">{t('remove.body')}</p>
      {teacher && <p className="mb-0 mt-3 text-sm text-ink-soft">{t('remove.teacherBody')}</p>}
      {self && <p className="mb-0 mt-3 text-sm font-semibold text-danger">{t('remove.selfBody')}</p>}
      {error && <FormError className="mt-3">{error}</FormError>}
    </Modal>
  );
}
